import "server-only";
import { db } from "@/lib/db";
import { dayKey } from "@/lib/time";
import { addDays } from "@/modules/zeiterfassung/account-rules";
import { holidayName } from "@/modules/zeiterfassung/holidays";
import { APPROVED_STATUSES, dayFactorFor } from "./vacation";

export type Viewer = "admin" | "lead" | "colleague" | "self";

export interface CalendarCell {
  label: string;
  short: string;
  color: string;
  pending: boolean;
}

export interface CalendarRow {
  employeeId: string;
  name: string;
  department: string;
  cells: Record<string, CalendarCell>;
}

const ABSENT: CalendarCell = { label: "abwesend", short: "A", color: "#64748b", pending: false };

/**
 * Abwesenheiten für den Kalender. Krankheit sehen nur Admin und die Person selbst;
 * Abteilungsleiter sehen dort nur „abwesend“, Kollegen je nach Einstellung nur „abwesend“.
 */
export async function calendarRows(opts: {
  from: Date;
  to: Date;
  departmentIds?: string[];
  viewer: Viewer;
  viewerId?: string;
  hideReasonForColleagues: boolean;
  includePending: boolean;
}): Promise<CalendarRow[]> {
  const emps = await db.employee.findMany({
    where: { status: "AKTIV", tracksTime: true, ...(opts.departmentIds ? { departmentId: { in: opts.departmentIds } } : {}) },
    include: { department: true },
    orderBy: [{ department: { sortOrder: "asc" } }, { lastName: "asc" }],
  });
  const ids = emps.map((e) => e.id);
  const [absences, sick] = await Promise.all([
    db.absenceRequest.findMany({
      where: {
        employeeId: { in: ids },
        status: { in: opts.includePending ? ["BEANTRAGT", ...APPROVED_STATUSES] : [...APPROVED_STATUSES] },
        startDate: { lte: opts.to },
        endDate: { gte: opts.from },
      },
      include: { type: true },
    }),
    db.sickLeave.findMany({ where: { employeeId: { in: ids }, cancelledAt: null, startDate: { lte: opts.to }, endDate: { gte: opts.from } } }),
  ]);

  return emps.map((e) => {
    const self = opts.viewerId === e.id;
    const showReason = opts.viewer === "admin" || self || opts.viewer === "lead" || !opts.hideReasonForColleagues;
    const showSick = opts.viewer === "admin" || self;
    const cells: Record<string, CalendarCell> = {};
    for (const a of absences.filter((x) => x.employeeId === e.id)) {
      for (let d = a.startDate > opts.from ? a.startDate : opts.from; d <= a.endDate && d <= opts.to; d = addDays(d, 1)) {
        // Wochenenden und Feiertage nicht als Abwesenheit markieren
        if (d.getUTCDay() === 0 || d.getUTCDay() === 6 || holidayName(dayKey(d))) continue;
        const half = (a.halfDayStart && dayKey(d) === dayKey(a.startDate)) || (a.halfDayEnd && dayKey(d) === dayKey(a.endDate));
        cells[dayKey(d)] = showReason
          ? { label: `${a.type.name}${half ? " (½)" : ""}${a.status === "BEANTRAGT" ? " – beantragt" : ""}`, short: a.type.name.slice(0, 1) + (half ? "½" : ""), color: a.type.color, pending: a.status === "BEANTRAGT" }
          : { ...ABSENT, pending: a.status === "BEANTRAGT" };
      }
    }
    for (const s of sick.filter((x) => x.employeeId === e.id)) {
      for (let d = s.startDate > opts.from ? s.startDate : opts.from; d <= s.endDate && d <= opts.to; d = addDays(d, 1)) {
        cells[dayKey(d)] = showSick ? { label: s.childSick ? "Kind krank" : "Krank", short: "K", color: "#b91c1c", pending: false } : ABSENT;
      }
    }
    return { employeeId: e.id, name: `${e.firstName} ${e.lastName}`, department: e.department?.name ?? "–", cells };
  });
}

/**
 * Mindestbesetzung prüfen: an welchen Arbeitstagen des Antragstellers wären in seiner Abteilung
 * weniger Personen anwesend als eingestellt? (nur Hinweis, keine Sperre)
 */
export async function staffingConflicts(requestId: string): Promise<{ date: string; present: number; min: number; absent: string[] }[]> {
  const r = await db.absenceRequest.findUniqueOrThrow({ where: { id: requestId }, include: { employee: { include: { department: true, schedules: true } } } });
  const dept = r.employee.department;
  if (!dept?.minStaffing) return [];
  const members = await db.employee.findMany({ where: { departmentId: dept.id, status: "AKTIV", tracksTime: true }, include: { schedules: true } });
  const others = members.filter((m) => m.id !== r.employeeId);
  const [abs, sick] = await Promise.all([
    db.absenceRequest.findMany({
      where: { employeeId: { in: others.map((o) => o.id) }, status: { in: [...APPROVED_STATUSES] }, startDate: { lte: r.endDate }, endDate: { gte: r.startDate } },
    }),
    db.sickLeave.findMany({ where: { employeeId: { in: others.map((o) => o.id) }, cancelledAt: null, startDate: { lte: r.endDate }, endDate: { gte: r.startDate } } }),
  ]);
  const myFactor = await dayFactorFor(r.employee, r.startDate, r.endDate);
  const factors = new Map(await Promise.all(others.map(async (o) => [o.id, await dayFactorFor(o, r.startDate, r.endDate)] as const)));
  const out = [];
  for (let d = r.startDate; d <= r.endDate; d = addDays(d, 1)) {
    if (myFactor(d) <= 0) continue;
    const working = others.filter((o) => factors.get(o.id)!(d) > 0);
    const away = working.filter((o) => abs.some((a) => a.employeeId === o.id && a.startDate <= d && a.endDate >= d) || sick.some((s) => s.employeeId === o.id && s.startDate <= d && s.endDate >= d));
    const present = working.length - away.length;
    if (present < dept.minStaffing) out.push({ date: dayKey(d), present, min: dept.minStaffing, absent: away.map((a) => `${a.firstName} ${a.lastName}`) });
  }
  return out;
}
