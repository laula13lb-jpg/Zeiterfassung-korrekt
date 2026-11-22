import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { berlinDay } from "@/lib/time";
import { getSettings } from "./settings";

/** Stichtag: Ende des Austrittsjahres + N Jahre (wie steuerliche Aufbewahrungsfristen) */
export function anonymizeDue(exitDate: Date, retentionYears: number, today: Date): boolean {
  const end = new Date(Date.UTC(exitDate.getUTCFullYear() + retentionYears, 11, 31));
  return today > end;
}

/**
 * Datensparsamkeit / Löschkonzept (täglich):
 * - Anmeldeprotokoll nach 90 Tagen löschen, gelesene Benachrichtigungen nach 180 Tagen
 * - abgelaufene Sitzungen löschen
 * - ausgetretene Mitarbeiter nach Ablauf der Aufbewahrungsfrist anonymisieren:
 *   Name/Personalnummer/Zugangsdaten entfernt, Krankmeldungen gelöscht,
 *   Zeitdaten bleiben nur noch ohne Personenbezug (Statistik) erhalten.
 */
export async function applyRetention(now = new Date()) {
  const settings = await getSettings();
  const today = berlinDay(now);
  await db.loginAttempt.deleteMany({ where: { at: { lt: new Date(now.getTime() - 90 * 86_400_000) } } });
  await db.notification.deleteMany({ where: { readAt: { lt: new Date(now.getTime() - 180 * 86_400_000) } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });

  const exited = await db.employee.findMany({ where: { status: "AUSGETRETEN", anonymizedAt: null, exitDate: { not: null } } });
  let n = 0;
  for (const e of exited) {
    if (!anonymizeDue(e.exitDate!, settings.retentionYears, today)) continue;
    const tag = e.id.slice(-6).toUpperCase();
    await db.$transaction([
      db.employee.update({
        where: { id: e.id },
        data: {
          firstName: "Ehemalig", lastName: `#${tag}`, personnelNo: `ANON-${tag}`, email: null, loginName: null,
          pinHash: null, passwordHash: null, totpSecretEnc: null, totpEnabled: false, anonymizedAt: now,
        },
      }),
      db.sickLeave.deleteMany({ where: { employeeId: e.id } }),
      db.notification.deleteMany({ where: { employeeId: e.id } }),
      db.session.deleteMany({ where: { employeeId: e.id } }),
      db.loginAttempt.deleteMany({ where: { employeeId: e.id } }),
      db.stampEvent.updateMany({ where: { employeeId: e.id }, data: { ip: null } }),
      db.absenceRequest.updateMany({ where: { employeeId: e.id }, data: { comment: null, decisionReason: null, cancelReason: null } }),
      db.correctionRequest.updateMany({ where: { employeeId: e.id }, data: { message: "(anonymisiert)", decisionReason: null } }),
    ]);
    await audit({ action: "retention.anonymize", entityType: "Employee", entityId: e.id, subjectId: e.id, reason: `Aufbewahrungsfrist (${settings.retentionYears} Jahre nach Austrittsjahr) abgelaufen` });
    n++;
  }
  return n;
}
