"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { isRateLimited, LIMITS, registerFailure } from "@/lib/rate-limit";
import { hashSecret } from "./hashing";
import { validatePassword } from "./pin-policy";
import { createSession } from "./session";
import type { FormState } from "./actions";

/** Ersteinrichtung möglich, solange es noch keinen Admin gibt */
export async function setupNeeded(): Promise<boolean> {
  return (await db.employee.count({ where: { roles: { has: "ADMIN" } } })) === 0;
}

function tokenOk(given: string): boolean {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createFirstAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const rl = `setup:${ip}`;
  if (isRateLimited(rl, LIMITS.adminPerIp.max, LIMITS.adminPerIp.windowMs)) return { error: "Zu viele Versuche. Bitte später erneut." };
  if (!(await setupNeeded())) redirect("/admin/anmelden");

  const get = (k: string) => String(fd.get(k) ?? "").trim();
  if (!tokenOk(get("token"))) {
    registerFailure(rl, LIMITS.adminPerIp.windowMs);
    return { error: "Einrichtungscode falsch. Er steht in der Datei .env auf dem Server (SETUP_TOKEN)." };
  }
  const firstName = get("firstName");
  const lastName = get("lastName");
  const loginName = get("loginName").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!firstName || !lastName) return { error: "Bitte Vor- und Nachname angeben." };
  if (!/^[a-z0-9._-]{3,40}$/.test(loginName)) return { error: "Benutzername: 3–40 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Minus, Unterstrich." };
  if (password !== String(fd.get("repeatPassword") ?? "")) return { error: "Die Passwörter stimmen nicht überein." };
  const problem = validatePassword(password, { loginName });
  if (problem) return { error: problem };

  const admin = await db.employee.create({
    data: {
      personnelNo: get("personnelNo") || `ADMIN-${loginName}`,
      firstName,
      lastName,
      roles: ["ADMIN"],
      tracksTime: false,
      entryDate: new Date(new Date().toISOString().slice(0, 10)),
      loginName,
      passwordHash: await hashSecret(password),
      passwordMustChange: false,
      departmentId: (await db.department.findFirst({ where: { name: "Büro/Verwaltung" } }))?.id,
    },
  });
  await audit({ actorId: admin.id, subjectId: admin.id, action: "setup.first_admin", entityType: "Employee", entityId: admin.id, ip });
  await createSession(admin.id, "ADMIN");
  redirect("/admin/sicherheit");
}
