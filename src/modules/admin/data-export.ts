import "server-only";
import { db } from "@/lib/db";

/**
 * Datenauskunft nach Art. 15 DSGVO: alle zu einer Person gespeicherten Daten als JSON.
 * Ausgenommen sind Sicherheitsgeheimnisse (PIN-/Passwort-Hashes, 2FA-Schlüssel, Sitzungs-Tokens).
 */
export async function personalDataExport(employeeId: string) {
  const e = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { department: true, ledDepartments: { select: { name: true } } } });
  const [schedules, entitlements, stamps, entries, absences, sick, corrections, adjustments, closings, warnings, notifications, logins, auditLog] = await Promise.all([
    db.workSchedule.findMany({ where: { employeeId } }),
    db.vacationEntitlement.findMany({ where: { employeeId } }),
    db.stampEvent.findMany({ where: { employeeId }, orderBy: { at: "asc" } }),
    db.timeEntry.findMany({ where: { employeeId }, orderBy: { start: "asc" } }),
    db.absenceRequest.findMany({ where: { employeeId }, include: { type: { select: { name: true } } } }),
    db.sickLeave.findMany({ where: { employeeId } }),
    db.correctionRequest.findMany({ where: { employeeId } }),
    db.balanceAdjustment.findMany({ where: { employeeId } }),
    db.monthClosing.findMany({ where: { employeeId } }),
    db.timeWarning.findMany({ where: { employeeId } }),
    db.notification.findMany({ where: { employeeId } }),
    db.loginAttempt.findMany({ where: { employeeId }, orderBy: { at: "asc" } }),
    db.auditLog.findMany({ where: { OR: [{ subjectId: employeeId }, { actorId: employeeId }] }, orderBy: { at: "asc" } }),
  ]);
  const { pinHash, passwordHash, totpSecretEnc, pinFailedCount, pinLockedUntil, pwFailedCount, pwLockedUntil, ...stamm } = e;
  void pinHash; void passwordHash; void totpSecretEnc; void pinFailedCount; void pinLockedUntil; void pwFailedCount; void pwLockedUntil;
  return {
    hinweis: "Datenauskunft nach Art. 15 DSGVO – Autoklinik Bludau (Bludau GmbH). Zeitstempel in UTC. Sicherheitsdaten (PIN/Passwort-Hashes, 2FA-Schlüssel) sind aus Sicherheitsgründen nicht enthalten.",
    erstelltAm: new Date().toISOString(),
    stammdaten: { ...stamm, zweiFaktorAktiv: e.totpEnabled },
    arbeitszeitmodelle: schedules,
    urlaubsansprueche: entitlements,
    stempelungen: stamps,
    zeitbuchungen: entries,
    abwesenheiten: absences,
    krankmeldungen: sick,
    korrekturantraege: corrections,
    zeitkontoBuchungen: adjustments,
    monatsabschluesse: closings,
    hinweiseArbeitszeitgesetz: warnings,
    benachrichtigungen: notifications,
    anmeldeversuche: logins,
    aenderungsprotokoll: auditLog,
  };
}
