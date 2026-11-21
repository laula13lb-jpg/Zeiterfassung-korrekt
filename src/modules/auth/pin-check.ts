import "server-only";
import type { Employee, LoginKind } from "@prisma/client";
import { db } from "@/lib/db";
import { isRateLimited, LIMITS, registerFailure } from "@/lib/rate-limit";
import { verifySecret } from "./hashing";
import { afterFailure, isLocked, remainingLockMinutes } from "./lockout";

/**
 * PIN prüfen inkl. Sperre nach 5 Fehlversuchen, Rate-Limit pro IP und Protokoll.
 * Gemeinsam genutzt von persönlicher Anmeldung und Terminal.
 */
export async function checkPin(
  emp: Employee | null,
  pin: string,
  ctx: { ip: string | null; kind: LoginKind; identifier?: string },
): Promise<{ ok: true; employee: Employee } | { ok: false; error: string }> {
  const rlKey = `pin:${ctx.ip}`;
  if (isRateLimited(rlKey, LIMITS.pinPerIp.max, LIMITS.pinPerIp.windowMs)) {
    return { ok: false, error: "Zu viele Fehlversuche von diesem Gerät. Bitte in einigen Minuten erneut versuchen." };
  }
  if (!emp || emp.status !== "AKTIV" || !emp.pinHash) {
    await verifySecret(null, pin);
    registerFailure(rlKey, LIMITS.pinPerIp.windowMs);
    await db.loginAttempt.create({ data: { kind: ctx.kind, identifier: ctx.identifier?.slice(0, 100), ip: ctx.ip, success: false, reason: "unbekannt/inaktiv" } });
    return { ok: false, error: "Anmeldung nicht möglich. Personalnummer oder PIN prüfen." };
  }
  const state = { failedCount: emp.pinFailedCount, lockedUntil: emp.pinLockedUntil };
  if (isLocked(state)) {
    await db.loginAttempt.create({ data: { kind: ctx.kind, employeeId: emp.id, ip: ctx.ip, success: false, reason: "gesperrt" } });
    return { ok: false, error: `Zu viele Fehlversuche. Gesperrt für noch ${remainingLockMinutes(state)} Min.` };
  }
  if (!(await verifySecret(emp.pinHash, pin))) {
    const next = afterFailure(state);
    await db.employee.update({ where: { id: emp.id }, data: { pinFailedCount: next.failedCount, pinLockedUntil: next.lockedUntil } });
    await db.loginAttempt.create({ data: { kind: ctx.kind, employeeId: emp.id, ip: ctx.ip, success: false, reason: "PIN falsch" } });
    registerFailure(rlKey, LIMITS.pinPerIp.windowMs);
    if (next.lockedUntil) return { ok: false, error: `PIN falsch. Zu viele Fehlversuche – für ${remainingLockMinutes(next)} Min. gesperrt.` };
    return { ok: false, error: `PIN falsch. Noch ${5 - next.failedCount} Versuch(e).` };
  }
  if (emp.pinFailedCount || emp.pinLockedUntil) {
    await db.employee.update({ where: { id: emp.id }, data: { pinFailedCount: 0, pinLockedUntil: null } });
  }
  await db.loginAttempt.create({ data: { kind: ctx.kind, employeeId: emp.id, ip: ctx.ip, success: true } });
  return { ok: true, employee: emp };
}
