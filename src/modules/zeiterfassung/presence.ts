import "server-only";
import { db } from "@/lib/db";
import { berlinDay } from "@/lib/time";
import { APPROVED_STATUSES, dayFactorFor } from "@/modules/abwesenheit/vacation";

export type PresenceState = "DA" | "PAUSE" | "GEGANGEN" | "ABWESEND" | "FEHLT" | "FREI";

export interface PresenceRow {
  id: string;
  name: string;
  department: string;
  state: PresenceState;
  since: Date | null;
  reason: string | null;
}

/** Wer ist da? Krankheit sehen nur Admins als „Krank“, sonst „abwesend“. */
export async function presenceBoard(opts: { departmentIds?: string[]; showSickReason: boolean }): Promise<PresenceRow[]> {
  const today = berlinDay();
  const emps = await db.employee.findMany({
    where: { status: "AKTIV", tracksTime: true, ...(opts.departmentIds ? { departmentId: { in: opts.departmentIds } } : {}) },
    include: { department: true, schedules: true },
    orderBy: [{ department: { sortOrder: "asc" } }, { lastName: "asc" }],
  });
  const ids = emps.map((e) => e.id);
  const [open, todayEntries, abs, sick] = await Promise.all([
    db.timeEntry.findMany({ where: { employeeId: { in: ids }, end: null, voidedAt: null, workDate: today } }),
    db.timeEntry.findMany({ where: { employeeId: { in: ids }, voidedAt: null, workDate: today }, select: { employeeId: true } }),
    db.absenceRequest.findMany({ where: { employeeId: { in: ids }, status: { in: [...APPROVED_STATUSES] }, startDate: { lte: today }, endDate: { gte: today } }, include: { type: true } }),
    db.sickLeave.findMany({ where: { employeeId: { in: ids }, cancelledAt: null, startDate: { lte: today }, endDate: { gte: today } } }),
  ]);
  return Promise.all(
    emps.map(async (e) => {
      const o = open.find((x) => x.employeeId === e.id);
      const base = { id: e.id, name: `${e.firstName} ${e.lastName}`, department: e.department?.name ?? "Ohne Abteilung" };
      if (o) return { ...base, state: o.kind === "PAUSE" ? "PAUSE" : "DA", since: o.start, reason: null } as PresenceRow;
      const s = sick.find((x) => x.employeeId === e.id);
      if (s) return { ...base, state: "ABWESEND", since: null, reason: opts.showSickReason ? (s.childSick ? "Kind krank" : "Krank") : "abwesend" } as PresenceRow;
      const a = abs.find((x) => x.employeeId === e.id);
      if (a) return { ...base, state: "ABWESEND", since: null, reason: a.type.name } as PresenceRow;
      if (todayEntries.some((x) => x.employeeId === e.id)) return { ...base, state: "GEGANGEN", since: null, reason: null } as PresenceRow;
      const f = await dayFactorFor(e, today, today);
      return { ...base, state: f(today) > 0 ? "FEHLT" : "FREI", since: null, reason: null } as PresenceRow;
    }),
  );
}
