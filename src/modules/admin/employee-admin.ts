"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { randomToken } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { berlinDay } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { hashSecret } from "@/modules/auth/hashing";
import { validatePassword, validatePin } from "@/modules/auth/pin-policy";
import { destroyAllSessions } from "@/modules/auth/session";

export type EmpState = { error?: string; ok?: string; pin?: string; password?: string; id?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const parseDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

/** Zufällige, nicht triviale Start-PIN (4 Ziffern) */
function newStartPin(personnelNo: string): string {
  for (;;) {
    const pin = String(randomInt(0, 10_000)).padStart(4, "0");
    if (!validatePin(pin, { personnelNo })) return pin;
  }
}

/** Zufälliges Startpasswort für Admins (muss beim ersten Login geändert werden) */
function newStartPassword(): string {
  for (;;) {
    const pw = `Start-${randomToken(6).replace(/[-_]/g, "x")}-${randomInt(10, 99)}!`;
    if (!validatePassword(pw)) return pw;
  }
}

function readRoles(fd: FormData): Role[] {
  const roles: Role[] = ["MITARBEITER"];
  if (fd.get("roleLead") === "on") roles.push("ABTEILUNGSLEITER");
  if (fd.get("roleAdmin") === "on") roles.push("ADMIN");
  return roles;
}

async function validateCommon(fd: FormData, exceptId?: string): Promise<string | null> {
  const personnelNo = str(fd, "personnelNo");
  if (!/^[A-Za-z0-9-]{1,20}$/.test(personnelNo)) return "Personalnummer: 1–20 Zeichen (Ziffern, Buchstaben, Minus).";
  if (await db.employee.findFirst({ where: { personnelNo, ...(exceptId ? { id: { not: exceptId } } : {}) } })) return "Diese Personalnummer ist schon vergeben.";
  if (!str(fd, "firstName") || !str(fd, "lastName")) return "Bitte Vor- und Nachname angeben.";
  if (!parseDay(str(fd, "entryDate"))) return "Bitte Eintrittsdatum angeben.";
  const email = str(fd, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "E-Mail-Adresse ungültig.";
  if (fd.get("roleAdmin") === "on") {
    const login = str(fd, "loginName").toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(login)) return "Admins brauchen einen Benutzernamen (3–40 Zeichen: a–z, 0–9, . _ -).";
    if (await db.employee.findFirst({ where: { loginName: login, ...(exceptId ? { id: { not: exceptId } } : {}) } })) return "Benutzername ist schon vergeben.";
  }
  return null;
}

export async function createEmployee(_prev: EmpState, fd: FormData): Promise<EmpState> {
  const { employee: admin } = await requireAdmin();
  const err = await validateCommon(fd);
  if (err) return { error: err };
  const roles = readRoles(fd);
  const entryDate = parseDay(str(fd, "entryDate"))!;
  const today = berlinDay();
  const personnelNo = str(fd, "personnelNo");
  const tracksTime = fd.get("tracksTime") === "on";
  const pin = tracksTime || !roles.includes("ADMIN") ? newStartPin(personnelNo) : null;
  const password = roles.includes("ADMIN") ? newStartPassword() : null;
  const weekly = Number(str(fd, "weeklyHours").replace(",", ".")) || 39;
  // Standardverteilung: Mo–Do gleich, Freitag 1 Std. kürzer (bei 39 Std.: 8/8/8/8/7)
  const fri = Math.max(0, Math.round(((weekly - 4) / 5) * 60));
  const monThu = Math.round((weekly * 60 - fri) / 4);
  const emp = await db.employee.create({
    data: {
      personnelNo,
      firstName: str(fd, "firstName"),
      lastName: str(fd, "lastName"),
      email: str(fd, "email") || null,
      departmentId: str(fd, "departmentId") || null,
      roles,
      tracksTime,
      entryDate,
      timeAccountStart: entryDate > today ? entryDate : today,
      pinHash: pin ? await hashSecret(pin) : null,
      pinMustChange: true,
      loginName: roles.includes("ADMIN") ? str(fd, "loginName").toLowerCase() : null,
      passwordHash: password ? await hashSecret(password) : null,
      passwordMustChange: true,
      schedules: { create: { validFrom: entryDate, monMinutes: monThu, tueMinutes: monThu, wedMinutes: monThu, thuMinutes: monThu, friMinutes: fri } },
      ...(roles.includes("ABTEILUNGSLEITER") ? { ledDepartments: { connect: fd.getAll("leadOf").map((id) => ({ id: String(id) })) } } : {}),
    },
  });
  await audit({ actorId: admin.id, subjectId: emp.id, action: "employee.create", entityType: "Employee", entityId: emp.id, after: { personnelNo, name: `${emp.firstName} ${emp.lastName}`, roles, departmentId: emp.departmentId }, ip: await clientIp() });
  revalidatePath("/admin/mitarbeiter");
  return { ok: `${emp.firstName} ${emp.lastName} wurde angelegt.`, pin: pin ?? undefined, password: password ?? undefined, id: emp.id };
}

export async function updateEmployee(_prev: EmpState, fd: FormData): Promise<EmpState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  const before = await db.employee.findUniqueOrThrow({ where: { id }, include: { ledDepartments: { select: { id: true } } } });
  const err = await validateCommon(fd, id);
  if (err) return { error: err };
  const roles = readRoles(fd);
  if (before.roles.includes("ADMIN") && !roles.includes("ADMIN")) {
    if (id === admin.id) return { error: "Sie können sich die Admin-Rolle nicht selbst entziehen." };
    const admins = await db.employee.count({ where: { status: "AKTIV", roles: { has: "ADMIN" }, id: { not: id } } });
    if (admins === 0) return { error: "Es muss mindestens ein aktiver Admin bleiben." };
  }
  const becomesAdmin = roles.includes("ADMIN") && !before.passwordHash;
  const password = becomesAdmin ? newStartPassword() : null;
  const data = {
    personnelNo: str(fd, "personnelNo"),
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: str(fd, "email") || null,
    departmentId: str(fd, "departmentId") || null,
    roles,
    tracksTime: fd.get("tracksTime") === "on",
    entryDate: parseDay(str(fd, "entryDate"))!,
    loginName: roles.includes("ADMIN") ? str(fd, "loginName").toLowerCase() : null,
  };
  const after = await db.employee.update({
    where: { id },
    data: {
      ...data,
      ...(password ? { passwordHash: await hashSecret(password), passwordMustChange: true } : {}),
      ...(!roles.includes("ADMIN") ? { passwordHash: null, totpEnabled: false, totpSecretEnc: null } : {}),
      ledDepartments: { set: roles.includes("ABTEILUNGSLEITER") ? fd.getAll("leadOf").map((d) => ({ id: String(d) })) : [] },
    },
  });
  if (!roles.includes("ADMIN")) await destroyAllSessions(id, "ADMIN");
  await audit({
    actorId: admin.id, subjectId: id, action: "employee.update", entityType: "Employee", entityId: id, ip: await clientIp(),
    before: { ...Object.fromEntries(Object.keys(data).map((k) => [k, before[k as keyof typeof before]])), leadOf: before.ledDepartments.map((d) => d.id) },
    after: { ...data, leadOf: fd.getAll("leadOf").map(String) },
  });
  revalidatePath(`/admin/mitarbeiter/${id}`);
  return { ok: password ? `Gespeichert. Admin-Zugang „${after.loginName}“ eingerichtet.` : "Gespeichert.", password: password ?? undefined };
}

/** Sperren / Entsperren / Austritt */
export async function setEmployeeStatus(_prev: EmpState, fd: FormData): Promise<EmpState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  const op = str(fd, "op");
  const emp = await db.employee.findUniqueOrThrow({ where: { id } });
  if (id === admin.id && op !== "unlock") return { error: "Sie können sich nicht selbst sperren oder austreten lassen." };
  if (emp.roles.includes("ADMIN") && op !== "unlock") {
    const others = await db.employee.count({ where: { status: "AKTIV", roles: { has: "ADMIN" }, id: { not: id } } });
    if (others === 0) return { error: "Es muss mindestens ein aktiver Admin bleiben." };
  }
  const ip = await clientIp();
  if (op === "lock") {
    await db.employee.update({ where: { id }, data: { status: "GESPERRT" } });
    await destroyAllSessions(id);
    await audit({ actorId: admin.id, subjectId: id, action: "employee.lock", entityType: "Employee", entityId: id, reason: str(fd, "reason") || null, ip });
    revalidatePath(`/admin/mitarbeiter/${id}`);
    return { ok: "Gesperrt. Anmeldung und Stempeln sind nicht mehr möglich." };
  }
  if (op === "unlock") {
    await db.employee.update({ where: { id }, data: { status: "AKTIV", exitDate: emp.status === "AUSGETRETEN" ? null : emp.exitDate, pinFailedCount: 0, pinLockedUntil: null, pwFailedCount: 0, pwLockedUntil: null } });
    await audit({ actorId: admin.id, subjectId: id, action: "employee.unlock", entityType: "Employee", entityId: id, ip });
    revalidatePath(`/admin/mitarbeiter/${id}`);
    return { ok: "Entsperrt." };
  }
  if (op === "exit") {
    const exitDate = parseDay(str(fd, "exitDate"));
    if (!exitDate) return { error: "Bitte Austrittsdatum angeben." };
    if (exitDate < emp.entryDate) return { error: "Austritt vor Eintritt ist nicht möglich." };
    const past = exitDate < berlinDay();
    await db.employee.update({ where: { id }, data: { exitDate, ...(past ? { status: "AUSGETRETEN" } : {}) } });
    if (past) await destroyAllSessions(id);
    await audit({ actorId: admin.id, subjectId: id, action: "employee.exit", entityType: "Employee", entityId: id, after: { exitDate }, ip });
    revalidatePath(`/admin/mitarbeiter/${id}`);
    return { ok: past ? "Ausgetreten. Die Daten bleiben für die Aufbewahrungsfristen erhalten." : `Austritt zum ${str(fd, "exitDate").split("-").reverse().join(".")} vorgemerkt – bis dahin bleibt der Zugang aktiv.` };
  }
  return { error: "Unbekannte Aktion." };
}

/** Neue Start-PIN vergeben (muss beim nächsten Login geändert werden) */
export async function resetPin(_prev: EmpState, fd: FormData): Promise<EmpState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  const emp = await db.employee.findUniqueOrThrow({ where: { id } });
  const pin = newStartPin(emp.personnelNo);
  await db.employee.update({ where: { id }, data: { pinHash: await hashSecret(pin), pinMustChange: true, pinFailedCount: 0, pinLockedUntil: null } });
  await destroyAllSessions(id, "MITARBEITER");
  await audit({ actorId: admin.id, subjectId: id, action: "auth.pin_reset", entityType: "Employee", entityId: id, ip: await clientIp() });
  return { ok: "Neue Start-PIN vergeben. Bitte persönlich mitteilen – sie wird nur jetzt angezeigt.", pin };
}

/** Passwort (und optional 2FA) eines anderen Admins zurücksetzen */
export async function resetAdminPassword(_prev: EmpState, fd: FormData): Promise<EmpState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  if (id === admin.id) return { error: "Ihr eigenes Passwort ändern Sie unter „Mein Zugang“." };
  const emp = await db.employee.findUniqueOrThrow({ where: { id } });
  if (!emp.roles.includes("ADMIN")) return { error: "Kein Admin-Konto." };
  const password = newStartPassword();
  await db.employee.update({
    where: { id },
    data: { passwordHash: await hashSecret(password), passwordMustChange: true, pwFailedCount: 0, pwLockedUntil: null, ...(fd.get("reset2fa") === "on" ? { totpEnabled: false, totpSecretEnc: null } : {}) },
  });
  await destroyAllSessions(id, "ADMIN");
  await audit({ actorId: admin.id, subjectId: id, action: "auth.password_reset", entityType: "Employee", entityId: id, after: { reset2fa: fd.get("reset2fa") === "on" }, ip: await clientIp() });
  return { ok: "Neues Startpasswort vergeben – nur jetzt sichtbar, bitte persönlich übergeben.", password };
}
