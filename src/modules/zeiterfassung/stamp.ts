import "server-only";
import type { StampSource } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { berlinDay, fmtDateTime } from "@/lib/time";
import { getSettings } from "@/modules/admin/settings";
import { isDuplicate, isStale, planStamp, statusFromOpen, type StampType, type Status } from "./rules";

export interface StampInput {
  employeeId: string;
  type: StampType;
  /** Zeitpunkt; Standard: jetzt (Serverzeit). Nur Offline-Nachsynchronisation liefert eigene Zeit. */
  at?: Date;
  source: StampSource;
  offline?: boolean;
  clientId?: string | null;
  terminalId?: string | null;
  ip?: string | null;
}

export type StampResult =
  | { ok: true; type: StampType; at: Date; status: Status; duplicate?: boolean; autoClosedNotice?: string }
  | { ok: false; error: string };

/** Offline erfasste Zeitstempel dürfen höchstens so alt sein */
const MAX_OFFLINE_AGE_H = 72;

/**
 * Stempelung ausführen – atomar je Mitarbeiter (Zeilensperre), idempotent über clientId,
 * Schutz vor Doppeltippen. Originaldaten bleiben als StampEvent erhalten.
 */
export async function performStamp(input: StampInput): Promise<StampResult> {
  const now = new Date();
  const at = input.at ?? now;
  if (input.at) {
    if (at.getTime() > now.getTime() + 2 * 60_000) return { ok: false, error: "Zeitstempel liegt in der Zukunft." };
    if (now.getTime() - at.getTime() > MAX_OFFLINE_AGE_H * 3600_000) return { ok: false, error: "Zeitstempel ist zu alt – bitte Korrekturantrag stellen." };
  }
  const settings = await getSettings();

  return db.$transaction(async (tx) => {
    // Zeilensperre: parallele Stempelungen derselben Person nacheinander abarbeiten
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${input.employeeId} FOR UPDATE`;
    const emp = await tx.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp || emp.status !== "AKTIV" || !emp.tracksTime) return { ok: false as const, error: "Für diese Person ist keine Zeiterfassung aktiv." };

    if (input.clientId) {
      const prev = await tx.stampEvent.findUnique({ where: { clientId: input.clientId } });
      if (prev) {
        const open = await tx.timeEntry.findFirst({ where: { employeeId: emp.id, end: null, supersededById: null, voidedAt: null } });
        return { ok: true as const, type: prev.type, at: prev.at, status: statusFromOpen(open), duplicate: true };
      }
    }

    let open = await tx.timeEntry.findFirst({
      where: { employeeId: emp.id, end: null, supersededById: null, voidedAt: null },
      orderBy: { start: "desc" },
    });
    const lastEvent = await tx.stampEvent.findFirst({ where: { employeeId: emp.id }, orderBy: { at: "desc" } });
    // Doppeltippen: dieselbe Aktion kurz hintereinander, die jetzt nicht mehr erlaubt wäre → als Erfolg werten
    if (isDuplicate(lastEvent, input.type, at) && "error" in planStamp(statusFromOpen(open), input.type)) {
      return { ok: true as const, type: input.type, at: lastEvent!.at, status: statusFromOpen(open), duplicate: true };
    }

    let autoClosedNotice: string | undefined;
    if (open && isStale(open, at, settings.maxShiftHours)) {
      // vergessenes Ausstempeln: Eintrag mit Dauer 0 schließen, Admin-Hinweis, Korrektur nötig
      await tx.timeEntry.update({ where: { id: open.id }, data: { end: open.start, autoClosed: true } });
      await tx.timeWarning.upsert({
        where: { employeeId_workDate_type: { employeeId: emp.id, workDate: open.workDate, type: "NICHT_AUSGESTEMPELT" } },
        create: { employeeId: emp.id, workDate: open.workDate, type: "NICHT_AUSGESTEMPELT", details: `Offen seit ${fmtDateTime(open.start)}` },
        update: {},
      });
      await audit({ action: "time.auto_close", entityType: "TimeEntry", entityId: open.id, subjectId: emp.id,
        before: { end: null }, after: { end: open.start, autoClosed: true }, reason: `Nicht ausgestempelt (älter als ${settings.maxShiftHours} Std.)` }, tx);
      autoClosedNotice = `Achtung: Am ${fmtDateTime(open.start).slice(0, 10)} wurde nicht ausgestempelt. Bitte Korrekturantrag stellen.`;
      open = null;
    }

    const status = statusFromOpen(open);
    const plan = planStamp(status, input.type);
    if ("error" in plan) return { ok: false as const, error: plan.error };
    if (open && at < open.start) return { ok: false as const, error: "Zeitstempel liegt vor der letzten Stempelung." };

    if (plan.close && open) await tx.timeEntry.update({ where: { id: open.id }, data: { end: at } });
    if (plan.open) {
      await tx.timeEntry.create({
        data: {
          employeeId: emp.id,
          kind: plan.open,
          start: at,
          // Fortsetzung einer Schicht (Pause/Ende Pause) bleibt am Arbeitstag des Schichtbeginns
          workDate: open ? open.workDate : berlinDay(at),
          origin: input.offline ? "OFFLINE" : "STEMPEL",
          departmentId: open?.departmentId ?? emp.departmentId,
        },
      });
    }
    await tx.stampEvent.create({
      data: {
        employeeId: emp.id, type: input.type, at, source: input.source, offline: !!input.offline,
        clientId: input.clientId ?? null, terminalId: input.terminalId ?? null, ip: input.ip ?? null,
      },
    });
    return { ok: true as const, type: input.type, at, status: plan.open === "PAUSE" ? "PAUSE" : plan.open === "ARBEIT" ? "ARBEIT" : "ABWESEND", autoClosedNotice };
  });
}
