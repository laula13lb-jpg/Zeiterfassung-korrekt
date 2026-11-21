"use server";

import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { encrypt, decrypt } from "@/lib/crypto";
import { isRateLimited, LIMITS, registerFailure } from "@/lib/rate-limit";
import { hashSecret, verifySecret } from "./hashing";
import { afterFailure, isLocked, remainingLockMinutes } from "./lockout";
import { validatePassword, validatePin } from "./pin-policy";
import { createSession, destroyAllSessions, destroySession, getSession, markSession2faDone } from "./session";
import { requireAdmin, requireEmployee } from "./guards";
import { getSettings } from "@/modules/admin/settings";
import { checkPin } from "./pin-check";

export type FormState = { error?: string; ok?: string } | undefined;

authenticator.options = { window: 1 };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ───────────── Mitarbeiter: PIN ─────────────

export async function loginWithPin(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const employeeId = str(fd, "employeeId");
  const personnelNo = str(fd, "personnelNo");
  const pin = str(fd, "pin");
  const emp = employeeId
    ? await db.employee.findUnique({ where: { id: employeeId } })
    : personnelNo
      ? await db.employee.findUnique({ where: { personnelNo } })
      : null;
  const res = await checkPin(emp, pin, { ip, kind: "PIN", identifier: personnelNo || employeeId });
  if (!res.ok) return { error: res.error };
  await createSession(res.employee.id, "MITARBEITER");
  redirect(res.employee.pinMustChange ? "/anmelden/pin-aendern" : "/mein");
}

export async function changePin(_prev: FormState, fd: FormData): Promise<FormState> {
  const emp = await requireEmployee({ allowPinChange: true });
  const current = str(fd, "currentPin");
  const next = str(fd, "newPin");
  const repeat = str(fd, "repeatPin");

  if (!(await verifySecret(emp.pinHash, current))) return { error: "Die bisherige PIN ist falsch." };
  if (next !== repeat) return { error: "Die beiden neuen PINs stimmen nicht überein." };
  if (next === current) return { error: "Die neue PIN muss sich von der bisherigen unterscheiden." };
  const problem = validatePin(next, { personnelNo: emp.personnelNo });
  if (problem) return { error: problem };

  await db.employee.update({
    where: { id: emp.id },
    data: { pinHash: await hashSecret(next), pinMustChange: false, pinChangedAt: new Date() },
  });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "auth.pin_change", entityType: "Employee", entityId: emp.id, ip: await clientIp() });
  redirect("/mein");
}

export async function logoutEmployee() {
  await destroySession("MITARBEITER");
  redirect("/anmelden");
}

// ───────────── Admin: Passwort + TOTP ─────────────

export async function loginAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const rlKey = `admin:${ip}`;
  if (isRateLimited(rlKey, LIMITS.adminPerIp.max, LIMITS.adminPerIp.windowMs)) {
    return { error: "Zu viele Fehlversuche. Bitte später erneut versuchen." };
  }
  const loginName = str(fd, "loginName").toLowerCase();
  const password = String(fd.get("password") ?? "");

  const emp = loginName ? await db.employee.findUnique({ where: { loginName } }) : null;
  const generic = "Benutzername oder Passwort falsch.";

  if (!emp || emp.status !== "AKTIV" || !emp.roles.includes("ADMIN")) {
    await verifySecret(null, password);
    registerFailure(rlKey, LIMITS.adminPerIp.windowMs);
    await db.loginAttempt.create({ data: { kind: "PASSWORT", identifier: loginName.slice(0, 100), ip, success: false, reason: "unbekannt" } });
    return { error: generic };
  }
  const state = { failedCount: emp.pwFailedCount, lockedUntil: emp.pwLockedUntil };
  if (isLocked(state)) {
    await db.loginAttempt.create({ data: { kind: "PASSWORT", employeeId: emp.id, ip, success: false, reason: "gesperrt" } });
    return { error: `Konto vorübergehend gesperrt (noch ${remainingLockMinutes(state)} Min.).` };
  }
  if (!(await verifySecret(emp.passwordHash, password))) {
    const next = afterFailure(state);
    await db.employee.update({ where: { id: emp.id }, data: { pwFailedCount: next.failedCount, pwLockedUntil: next.lockedUntil } });
    await db.loginAttempt.create({ data: { kind: "PASSWORT", employeeId: emp.id, ip, success: false, reason: "Passwort falsch" } });
    registerFailure(rlKey, LIMITS.adminPerIp.windowMs);
    return { error: generic };
  }
  await db.employee.update({ where: { id: emp.id }, data: { pwFailedCount: 0, pwLockedUntil: null } });
  await db.loginAttempt.create({ data: { kind: "PASSWORT", employeeId: emp.id, ip, success: true } });
  await createSession(emp.id, "ADMIN", { pending2fa: emp.totpEnabled });
  redirect(emp.totpEnabled ? "/admin/anmelden/2fa" : "/admin");
}

export async function verifyAdminTotp(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession("ADMIN");
  if (!s || !s.pending2fa) redirect("/admin/anmelden");
  const ip = await clientIp();
  const code = str(fd, "code").replace(/\s/g, "");
  const emp = s.employee;
  const state = { failedCount: emp.pwFailedCount, lockedUntil: emp.pwLockedUntil };
  if (isLocked(state)) return { error: `Konto vorübergehend gesperrt (noch ${remainingLockMinutes(state)} Min.).` };

  const ok = !!emp.totpSecretEnc && authenticator.check(code, decrypt(emp.totpSecretEnc));
  if (!ok) {
    const next = afterFailure(state);
    await db.employee.update({ where: { id: emp.id }, data: { pwFailedCount: next.failedCount, pwLockedUntil: next.lockedUntil } });
    await db.loginAttempt.create({ data: { kind: "TOTP", employeeId: emp.id, ip, success: false } });
    registerFailure(`admin:${ip}`, LIMITS.adminPerIp.windowMs);
    if (next.lockedUntil) {
      await destroySession("ADMIN");
      redirect("/admin/anmelden");
    }
    return { error: "Code falsch oder abgelaufen." };
  }
  await db.employee.update({ where: { id: emp.id }, data: { pwFailedCount: 0, pwLockedUntil: null } });
  await db.loginAttempt.create({ data: { kind: "TOTP", employeeId: emp.id, ip, success: true } });
  await markSession2faDone(s.id);
  redirect("/admin");
}

export async function changeAdminPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const { employee: emp } = await requireAdmin({ allowPasswordChange: true });
  const current = String(fd.get("currentPassword") ?? "");
  const next = String(fd.get("newPassword") ?? "");
  const repeat = String(fd.get("repeatPassword") ?? "");
  if (!(await verifySecret(emp.passwordHash, current))) return { error: "Das bisherige Passwort ist falsch." };
  if (next !== repeat) return { error: "Die neuen Passwörter stimmen nicht überein." };
  if (next === current) return { error: "Das neue Passwort muss sich vom bisherigen unterscheiden." };
  const problem = validatePassword(next, { loginName: emp.loginName ?? undefined });
  if (problem) return { error: problem };
  await db.employee.update({ where: { id: emp.id }, data: { passwordHash: await hashSecret(next), passwordMustChange: false } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "auth.password_change", entityType: "Employee", entityId: emp.id, ip: await clientIp() });
  const settings = await getSettings();
  redirect(settings.requireAdmin2fa && !emp.totpEnabled ? "/admin/sicherheit" : "/admin");
}

/** Schritt 1: neuen TOTP-Schlüssel erzeugen (noch nicht aktiv) */
export async function startTotpSetup(): Promise<void> {
  const { employee: emp } = await requireAdmin({ allowPasswordChange: false });
  if (emp.totpEnabled) return;
  const secret = authenticator.generateSecret(20);
  await db.employee.update({ where: { id: emp.id }, data: { totpSecretEnc: encrypt(secret) } });
  redirect("/admin/sicherheit");
}

/** Schritt 2: Code aus der Authenticator-App bestätigen → 2FA aktiv */
export async function confirmTotpSetup(_prev: FormState, fd: FormData): Promise<FormState> {
  const { employee: emp } = await requireAdmin();
  if (!emp.totpSecretEnc) return { error: "Bitte zuerst die Einrichtung starten." };
  const code = str(fd, "code").replace(/\s/g, "");
  if (!authenticator.check(code, decrypt(emp.totpSecretEnc))) return { error: "Code stimmt nicht. Uhrzeit am Handy prüfen und erneut versuchen." };
  await db.employee.update({ where: { id: emp.id }, data: { totpEnabled: true } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "auth.2fa_enable", entityType: "Employee", entityId: emp.id, ip: await clientIp() });
  return { ok: "Zwei-Faktor-Anmeldung ist jetzt aktiv." };
}

export async function disableTotp(_prev: FormState, fd: FormData): Promise<FormState> {
  const { employee: emp } = await requireAdmin();
  const settings = await getSettings();
  if (settings.requireAdmin2fa) return { error: "2FA ist für Admins vorgeschrieben und kann nicht abgeschaltet werden." };
  if (!(await verifySecret(emp.passwordHash, String(fd.get("password") ?? "")))) return { error: "Passwort falsch." };
  await db.employee.update({ where: { id: emp.id }, data: { totpEnabled: false, totpSecretEnc: null } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "auth.2fa_disable", entityType: "Employee", entityId: emp.id, ip: await clientIp() });
  return { ok: "Zwei-Faktor-Anmeldung wurde abgeschaltet." };
}

export async function logoutAdmin() {
  await destroySession("ADMIN");
  redirect("/admin/anmelden");
}

// ───────────── Admin: PIN zurücksetzen ─────────────

export async function resetEmployeePin(employeeId: string, startPin: string, reason: string) {
  const { employee: admin } = await requireAdmin();
  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  if (!/^\d{4,6}$/.test(startPin)) throw new Error("Start-PIN muss 4–6 Ziffern haben.");
  await db.employee.update({
    where: { id: employeeId },
    data: { pinHash: await hashSecret(startPin), pinMustChange: true, pinFailedCount: 0, pinLockedUntil: null },
  });
  await destroyAllSessions(employeeId, "MITARBEITER");
  await audit({ actorId: admin.id, subjectId: emp.id, action: "auth.pin_reset", entityType: "Employee", entityId: emp.id, reason, ip: await clientIp() });
}
