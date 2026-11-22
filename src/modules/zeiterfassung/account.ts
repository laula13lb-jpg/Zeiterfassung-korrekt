import "server-only";
import { db } from "@/lib/db";
import { berlinDay } from "@/lib/time";
import { getSettings, summaryOptionsFor, type Settings } from "@/modules/admin/settings";
import { addDays, computeDay, dayKeyOf, type AbsenceOnDay, type CompanyDayLike, type DayAccount } from "./account-rules";
import { summarizeDay, type DaySummary } from "./rules";

export interface AccountDay extends DayAccount {
  summary: DaySummary | null;
  /** Tag liegt in der Zukunft bzw. ist heute (zählt noch nicht zum Saldo) */
  pending: boolean;
  corrected: boolean;
  autoClosed: boolean;
}

export interface MonthAccount {
  year: number;
  month: number;
  accountStart: string;
  days: AccountDay[];
  /** Saldo zu Monatsbeginn (Übertrag) */
  openingBalance: number;
  /** Summe Soll/Ist/Differenz der abgeschlossenen Tage im Monat */
  targetSum: number;
  actualSum: number;
  diffSum: number;
  adjustments: { id: string; date: string; minutes: number; kind: string; reason: string }[];
  adjustmentSum: number;
  /** Saldo am Monatsende bzw. bis gestern */
  closingBalance: number;
  weeks: { week: number; targetSum: number; actualSum: number; diffSum: number; settled: boolean }[];
}

const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0));

/** ISO-Kalenderwoche eines @db.Date-Tages */
export function isoWeek(day: Date): number {
  const d = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Alle Tage vom Beginn des Zeitkontos bis `until` berechnen.
 * Der Saldo zählt nur abgeschlossene Tage (vor heute).
 */
async function computeDays(employeeId: string, until: Date, settings: Settings, now: Date) {
  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { schedules: true } });
  const accountStart = emp.timeAccountStart ?? emp.entryDate;
  const today = berlinDay(now);
  const from = accountStart;

  const [entries, companyDays, absences, sick, adjustments] = await Promise.all([
    db.timeEntry.findMany({
      where: { employeeId, voidedAt: null, workDate: { gte: from, lte: until } },
      select: { kind: true, start: true, end: true, workDate: true, origin: true, autoClosed: true },
    }),
    db.companyDay.findMany({ where: { date: { gte: from, lte: until } } }),
    db.absenceRequest.findMany({
      where: { employeeId, status: { in: ["GENEHMIGT", "STORNO_BEANTRAGT"] }, startDate: { lte: until }, endDate: { gte: from } },
      include: { type: true },
    }),
    db.sickLeave.findMany({ where: { employeeId, cancelledAt: null, startDate: { lte: until }, endDate: { gte: from } } }),
    db.balanceAdjustment.findMany({ where: { employeeId, date: { gte: from, lte: until } }, orderBy: { date: "asc" } }),
  ]);

  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = dayKeyOf(e.workDate);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(e);
  }
  const cdMap = new Map(companyDays.map((c) => [dayKeyOf(c.date), { ...c, targetFactor: Number(c.targetFactor) } as CompanyDayLike]));

  const days: AccountDay[] = [];
  for (let day = from; day <= until; day = addDays(day, 1)) {
    const k = dayKeyOf(day);
    const dayEntries = byDay.get(k) ?? [];
    const summary = dayEntries.length ? summarizeDay(dayEntries, { now, ...summaryOptionsFor(settings, day) }) : null;
    const abs: AbsenceOnDay[] = absences
      .filter((a) => a.startDate <= day && a.endDate >= day)
      .map((a) => {
        const half = (a.halfDayStart && dayKeyOf(a.startDate) === k) || (a.halfDayEnd && dayKeyOf(a.endDate) === k);
        return { label: a.type.name, category: a.type.category, creditsTarget: a.type.creditsTarget, fraction: half ? 0.5 : 1 };
      });
    const s = sick.find((x) => x.startDate <= day && x.endDate >= day);
    const acc = computeDay({
      day,
      schedules: emp.schedules,
      employmentStart: emp.entryDate > accountStart ? emp.entryDate : accountStart,
      employmentEnd: emp.exitDate,
      companyDay: cdMap.get(k) ?? null,
      absences: abs,
      sick: s ? { label: s.childSick ? "Kind krank" : "Krank", childSick: s.childSick } : null,
      workedMinutes: summary?.netWorkMinutes ?? 0,
      roundingMinutes: settings.roundingMinutes,
    });
    days.push({
      ...acc,
      summary,
      pending: day >= today,
      corrected: dayEntries.some((e) => e.origin === "KORREKTUR"),
      autoClosed: dayEntries.some((e) => e.autoClosed),
    });
  }
  return { emp, accountStart, days, adjustments };
}

export async function getMonthAccount(employeeId: string, year: number, month: number, now = new Date()): Promise<MonthAccount> {
  const settings = await getSettings();
  const mStart = monthStart(year, month);
  const mEnd = monthEnd(year, month);
  const { accountStart, days, adjustments } = await computeDays(employeeId, mEnd, settings, now);

  const settled = (d: AccountDay) => !d.pending;
  const before = days.filter((d) => d.date < dayKeyOf(mStart));
  const inMonth = days.filter((d) => d.date >= dayKeyOf(mStart));
  const adjBefore = adjustments.filter((a) => a.date < mStart).reduce((s, a) => s + a.minutes, 0);
  const adjIn = adjustments.filter((a) => a.date >= mStart);
  const openingBalance = before.filter(settled).reduce((s, d) => s + d.diffMinutes, 0) + adjBefore;
  const settledIn = inMonth.filter(settled);
  const diffSum = settledIn.reduce((s, d) => s + d.diffMinutes, 0);
  const adjustmentSum = adjIn.reduce((s, a) => s + a.minutes, 0);

  // auch Tage vor Kontobeginn im Monat anzeigen (leer)
  const shown: AccountDay[] = [];
  for (let day = mStart; day <= mEnd; day = addDays(day, 1)) {
    const k = dayKeyOf(day);
    shown.push(
      inMonth.find((d) => d.date === k) ?? {
        ...computeDay({ day, schedules: [], employmentStart: addDays(mEnd, 1), employmentEnd: null, workedMinutes: 0 }),
        // vor Beginn des Zeitkontos: nicht gewertet
        summary: null, pending: true, corrected: false, autoClosed: false,
      },
    );
  }

  const weekMap = new Map<number, MonthAccount["weeks"][number]>();
  for (const d of shown) {
    const w = isoWeek(new Date(`${d.date}T00:00:00Z`));
    const e = weekMap.get(w) ?? { week: w, targetSum: 0, actualSum: 0, diffSum: 0, settled: false };
    if (!d.pending) {
      e.settled = true;
      e.targetSum += d.targetMinutes;
      e.actualSum += d.actualMinutes;
      e.diffSum += d.diffMinutes;
    }
    weekMap.set(w, e);
  }

  return {
    year,
    month,
    accountStart: dayKeyOf(accountStart),
    days: shown,
    openingBalance,
    targetSum: settledIn.reduce((s, d) => s + d.targetMinutes, 0),
    actualSum: settledIn.reduce((s, d) => s + d.actualMinutes, 0),
    diffSum,
    adjustments: adjIn.map((a) => ({ id: a.id, date: dayKeyOf(a.date), minutes: a.minutes, kind: a.kind, reason: a.reason })),
    adjustmentSum,
    closingBalance: openingBalance + diffSum + adjustmentSum,
    weeks: [...weekMap.values()],
  };
}

/** Aktueller Saldo (bis einschließlich gestern) */
export async function currentBalance(employeeId: string, now = new Date()): Promise<number> {
  const settings = await getSettings();
  const yesterday = addDays(berlinDay(now), -1);
  const { days, accountStart } = await computeDays(employeeId, yesterday, settings, now);
  // Saldo-Buchungen zählen sofort (auch mit heutigem Datum)
  const adj = await db.balanceAdjustment.aggregate({
    where: { employeeId, date: { gte: accountStart, lte: berlinDay(now) } },
    _sum: { minutes: true },
  });
  return days.reduce((s, d) => s + d.diffMinutes, 0) + (adj._sum.minutes ?? 0);
}
