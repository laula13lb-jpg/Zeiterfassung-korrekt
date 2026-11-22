import "server-only";
import type { Employee, WorkSchedule } from "@prisma/client";
import { db } from "@/lib/db";
import { berlinDay, dayKey } from "@/lib/time";
import { getSettings, type Settings } from "@/modules/admin/settings";
import { plannedMinutes } from "@/modules/zeiterfassung/account-rules";
import { holidayName } from "@/modules/zeiterfassung/holidays";
import { countDays, expandRange, proRataEntitlement, vacationBalances, type DayFactor, type YearBalance } from "./vacation-rules";

export const ACTIVE_STATUSES = ["BEANTRAGT", "GENEHMIGT", "STORNO_BEANTRAGT"] as const;
export const APPROVED_STATUSES = ["GENEHMIGT", "STORNO_BEANTRAGT"] as const;

type EmpWithSchedules = Employee & { schedules: WorkSchedule[] };

async function loadEmp(employeeId: string): Promise<EmpWithSchedules> {
  return db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { schedules: true } });
}

/** Arbeitstag-Anteil je Kalendertag für eine Person (Arbeitszeitmodell, Feiertage, Betriebstage) */
export async function dayFactorFor(emp: EmpWithSchedules, from: Date, to: Date): Promise<DayFactor> {
  const cds = await db.companyDay.findMany({ where: { date: { gte: from, lte: to } } });
  const cd = new Map(cds.map((c) => [dayKey(c.date), c]));
  return (day: Date) => {
    if (day < emp.entryDate || (emp.exitDate && day > emp.exitDate)) return 0;
    if (plannedMinutes(emp.schedules, day) <= 0) return 0;
    if (holidayName(dayKey(day))) return 0;
    const c = cd.get(dayKey(day));
    if (c) {
      if (c.kind === "HALBER_TAG") return Number(c.targetFactor) > 0 ? 0.5 : 0;
      return 0; // freier Tag / Betriebsferien (Betriebsferien werden separat verrechnet)
    }
    return 1;
  };
}

export async function computeRequestDays(employeeId: string, start: Date, end: Date, halfDayStart: boolean, halfDayEnd: boolean) {
  const emp = await loadEmp(employeeId);
  const f = await dayFactorFor(emp, start, end);
  return countDays({ start, end, halfDayStart, halfDayEnd }, f);
}

/** Arbeitstage pro Woche laut Arbeitszeitmodell zu Jahresbeginn (bzw. Eintritt) */
function workdaysPerWeek(emp: EmpWithSchedules, year: number): number {
  const ref = new Date(Date.UTC(year, 0, 1)) > emp.entryDate ? new Date(Date.UTC(year, 0, 1)) : emp.entryDate;
  // eine Woche ab Montag nach dem Stichtag prüfen
  let n = 0;
  for (let i = 0; i < 7; i++) if (plannedMinutes(emp.schedules, new Date(ref.getTime() + i * 86_400_000)) > 0) n++;
  return n || 5;
}

export async function entitlementFor(emp: EmpWithSchedules, year: number, settings: Settings) {
  const row = await db.vacationEntitlement.findUnique({ where: { employeeId_year: { employeeId: emp.id, year } } });
  const computed = proRataEntitlement({
    baseDays: settings.defaultVacationDays,
    workdaysPerWeek: workdaysPerWeek(emp, year),
    year,
    entryDate: emp.entryDate,
    exitDate: emp.exitDate,
  });
  return {
    days: row ? Number(row.days) : computed,
    computed,
    explicit: !!row,
    carryOverOverride: row?.carryOverOverride != null ? Number(row.carryOverOverride) : null,
    note: row?.note ?? null,
  };
}

export interface VacationOverview {
  year: number;
  balance: YearBalance;
  /** beantragte, noch nicht entschiedene Tage */
  pending: number;
  /** Rest nach Abzug der offenen Anträge */
  available: number;
  computedEntitlement: number;
  explicitEntitlement: boolean;
  /** Hinweis auf verfallenden Urlaub (Hinweispflicht) */
  expiryWarning: string | null;
  all: YearBalance[];
}

/** Urlaubskonto einer Person für ein Jahr (inkl. Übertrag aus Vorjahren) */
export async function vacationOverview(employeeId: string, year: number, today = berlinDay()): Promise<VacationOverview> {
  const settings = await getSettings();
  const emp = await loadEmp(employeeId);
  const firstYear = Math.max((emp.timeAccountStart ?? emp.entryDate).getUTCFullYear(), emp.entryDate.getUTCFullYear());
  const lastYear = Math.max(year, firstYear);
  const from = new Date(Date.UTC(firstYear, 0, 1));
  const to = new Date(Date.UTC(lastYear, 11, 31));
  const factor = await dayFactorFor(emp, from, to);

  const [requests, holidays] = await Promise.all([
    db.absenceRequest.findMany({
      where: { employeeId, status: { in: [...ACTIVE_STATUSES] }, type: { deductsVacation: true }, startDate: { lte: to }, endDate: { gte: from } },
    }),
    db.companyDay.findMany({ where: { kind: "BETRIEBSFERIEN", countsAsVacation: true, date: { gte: from, lte: to } } }),
  ]);
  const sick = await db.sickLeave.findMany({ where: { employeeId, cancelledAt: null, startDate: { lte: to }, endDate: { gte: from } } });
  const isSick = (d: Date) => sick.some((s) => !s.childSick && s.startDate <= d && s.endDate >= d);
  // Krankheit während genehmigtem Urlaub: Urlaubstage werden erst nach Admin-Bestätigung zurückgebucht
  const refunded = (d: Date) => sick.some((s) => !s.childSick && s.vacationRefundConfirmedAt && s.startDate <= d && s.endDate >= d);

  const takenByYear = new Map<number, { day: Date; days: number }[]>();
  const pendingByYear = new Map<number, number>();
  for (const r of requests) {
    for (const x of expandRange({ start: r.startDate, end: r.endDate, halfDayStart: r.halfDayStart, halfDayEnd: r.halfDayEnd }, factor)) {
      const y = x.day.getUTCFullYear();
      if (r.status !== "BEANTRAGT" && refunded(x.day)) continue;
      if (r.status === "BEANTRAGT") pendingByYear.set(y, (pendingByYear.get(y) ?? 0) + x.days);
      else (takenByYear.get(y) ?? takenByYear.set(y, []).get(y)!).push(x);
    }
  }
  // Betriebsferien, die als Urlaub verrechnet werden
  for (const c of holidays) {
    const plannedDay = plannedMinutes(emp.schedules, c.date) > 0 && !holidayName(dayKey(c.date));
    const employed = c.date >= emp.entryDate && (!emp.exitDate || c.date <= emp.exitDate);
    if (plannedDay && employed && !isSick(c.date)) {
      const y = c.date.getUTCFullYear();
      (takenByYear.get(y) ?? takenByYear.set(y, []).get(y)!).push({ day: c.date, days: 1 });
    }
  }

  const years = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const e = await entitlementFor(emp, y, settings);
    years.push({ year: y, entitlement: e.days, carryOverOverride: e.carryOverOverride, taken: takenByYear.get(y) ?? [] });
  }
  const all = vacationBalances(years, {
    today,
    expiryMonthDay: settings.vacationExpiry ? settings.carryOverExpiry : null,
    trackedFrom: emp.timeAccountStart ?? emp.entryDate,
  });
  const balance = all.find((b) => b.year === year) ?? all.at(-1)!;
  const pending = pendingByYear.get(year) ?? 0;
  const ent = await entitlementFor(emp, year, settings);

  let expiryWarning: string | null = null;
  const cur = all.find((b) => b.year === today.getUTCFullYear());
  if (cur && cur.carryRemaining > 0 && cur.expiry) {
    const daysLeft = (cur.expiry.getTime() - today.getTime()) / 86_400_000;
    if (daysLeft <= settings.carryOverWarnDays) {
      expiryWarning = `${fmtDays(cur.carryRemaining)} Resturlaub aus ${cur.year - 1} verfallen am ${cur.expiry.toISOString().slice(8, 10)}.${cur.expiry.toISOString().slice(5, 7)}.${cur.year}, wenn sie bis dahin nicht genommen werden. Bitte rechtzeitig beantragen.`;
    }
  }
  // Hinweis zum Jahresende: Resturlaub des laufenden Jahres wird übertragen und verfällt später
  if (!expiryWarning && cur && settings.vacationExpiry && today.getUTCMonth() >= 9 && cur.remaining > 0) {
    expiryWarning = `Du hast für ${cur.year} noch ${fmtDays(cur.remaining)} Urlaub. Nicht genommener Urlaub wird übertragen und verfällt am ${settings.carryOverExpiry.slice(3, 5)}.${settings.carryOverExpiry.slice(0, 2)}.${cur.year + 1}.`;
  }

  return {
    year,
    balance,
    pending,
    available: balance.remaining - pending,
    computedEntitlement: ent.computed,
    explicitEntitlement: ent.explicit,
    expiryWarning,
    all,
  };
}

export const fmtDays = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${Math.abs(n) === 1 ? "Tag" : "Tage"}`;
