import "server-only";
import { db } from "@/lib/db";
import { berlinDay, dayKey } from "@/lib/time";
import { APPROVED_STATUSES, dayFactorFor } from "./vacation";
import { expandRange } from "./vacation-rules";
import { sickHints, daysWithin } from "./sick-rules";

/**
 * Krankmeldungen, die einen genehmigten Urlaub überschneiden und deren Urlaubstage
 * noch nicht zurückgebucht wurden (Admin muss bestätigen).
 */
export async function pendingVacationRefunds() {
  const sick = await db.sickLeave.findMany({
    where: { cancelledAt: null, childSick: false, vacationRefundConfirmedAt: null },
    include: { employee: { include: { schedules: true } } },
  });
  const out = [];
  for (const s of sick) {
    const vac = await db.absenceRequest.findMany({
      where: { employeeId: s.employeeId, status: { in: [...APPROVED_STATUSES] }, type: { deductsVacation: true }, startDate: { lte: s.endDate }, endDate: { gte: s.startDate } },
    });
    if (!vac.length) continue;
    const f = await dayFactorFor(s.employee, s.startDate, s.endDate);
    let days = 0;
    for (const v of vac) {
      for (const x of expandRange({ start: v.startDate, end: v.endDate, halfDayStart: v.halfDayStart, halfDayEnd: v.halfDayEnd }, f)) {
        if (x.day >= s.startDate && x.day <= s.endDate) days += x.days;
      }
    }
    if (days > 0) out.push({ sickId: s.id, employeeId: s.employeeId, name: `${s.employee.firstName} ${s.employee.lastName}`, start: s.startDate, end: s.endDate, auPresent: s.auPresent || s.eauRetrieved, days });
  }
  return out;
}

/** Auswertung pro Mitarbeiter: Krankheitstage im Jahr (Kalender- und Arbeitstage) + Hinweise */
export async function sickStatistics(year: number) {
  const today = berlinDay();
  const emps = await db.employee.findMany({
    where: { status: { not: "AUSGETRETEN" }, tracksTime: true },
    include: { schedules: true, department: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year, 11, 31));
  const all = await db.sickLeave.findMany({ where: { cancelledAt: null, startDate: { lte: to }, endDate: { gte: new Date(Date.UTC(year - 1, 0, 1)) } } });
  return Promise.all(
    emps.map(async (e) => {
      const mine = all.filter((s) => s.employeeId === e.id);
      const own = mine.filter((s) => !s.childSick).map((s) => ({ start: s.startDate, end: s.endDate }));
      const child = mine.filter((s) => s.childSick).map((s) => ({ start: s.startDate, end: s.endDate }));
      const f = await dayFactorFor(e, from, to);
      const workdays = (ps: { start: Date; end: Date }[]) =>
        ps.reduce((n, p) => n + expandRange({ start: p.start > from ? p.start : from, end: p.end < to ? p.end : to }, f).reduce((a, x) => a + x.days, 0), 0);
      const hints = sickHints(own, today);
      return {
        id: e.id,
        name: `${e.lastName}, ${e.firstName}`,
        department: e.department?.name ?? "",
        calendarDays: daysWithin(own, from, to),
        workdays: workdays(own.filter((p) => p.end >= from && p.start <= to)),
        childWorkdays: workdays(child.filter((p) => p.end >= from && p.start <= to)),
        ...hints,
      };
    }),
  );
}

/** Heute abwesend (für Admin-Übersicht) */
export async function absentToday() {
  const today = berlinDay();
  const [abs, sick] = await Promise.all([
    db.absenceRequest.findMany({
      where: { status: { in: [...APPROVED_STATUSES] }, startDate: { lte: today }, endDate: { gte: today } },
      include: { type: true, employee: { select: { firstName: true, lastName: true } } },
    }),
    db.sickLeave.findMany({ where: { cancelledAt: null, startDate: { lte: today }, endDate: { gte: today } }, include: { employee: { select: { firstName: true, lastName: true } } } }),
  ]);
  return [
    ...sick.map((s) => ({ name: `${s.employee.firstName} ${s.employee.lastName}`, reason: s.childSick ? "Kind krank" : "Krank", until: dayKey(s.endDate) })),
    ...abs.map((a) => ({ name: `${a.employee.firstName} ${a.employee.lastName}`, reason: a.type.name, until: dayKey(a.endDate) })),
  ];
}
