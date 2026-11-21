/**
 * Zeitkonto: Soll/Ist pro Tag (reine Logik, unit-getestet).
 * Kalendertage sind Date-Werte um 00:00 UTC (wie @db.Date).
 */
import { holidayName } from "./holidays";

export interface ScheduleLike {
  validFrom: Date;
  monMinutes: number;
  tueMinutes: number;
  wedMinutes: number;
  thuMinutes: number;
  friMinutes: number;
  satMinutes: number;
  sunMinutes: number;
}

export interface CompanyDayLike {
  date: Date;
  kind: "HALBER_TAG" | "BETRIEBSFERIEN" | "FREIER_TAG";
  name: string;
  targetFactor: number;
  countsAsVacation: boolean;
}

export type AbsenceCategory = "URLAUB" | "SONDERURLAUB" | "UNBEZAHLT" | "FREIZEITAUSGLEICH" | "SONSTIGE";

export interface AbsenceOnDay {
  label: string;
  category: AbsenceCategory;
  creditsTarget: boolean;
  /** 1 = ganzer Tag, 0.5 = halber Tag */
  fraction: number;
}

export interface DayInput {
  day: Date;
  schedules: ScheduleLike[];
  employmentStart: Date;
  employmentEnd: Date | null;
  companyDay?: CompanyDayLike | null;
  absences?: AbsenceOnDay[];
  sick?: { label: string } | null;
  /** angerechnete Arbeitszeit aus Stempelungen (nach Pausenabzug / Anrechnungsbeginn) */
  workedMinutes: number;
  /** Tagessumme auf volle N Minuten abrunden (0 = keine Rundung) */
  roundingMinutes?: number;
}

export interface DayAccount {
  date: string;
  weekday: number;
  /** Soll laut Arbeitszeitmodell (vor Feiertag/Abwesenheit) */
  plannedMinutes: number;
  targetMinutes: number;
  workedMinutes: number;
  /** gutgeschriebene Zeit für Urlaub, Krankheit, Feiertag-ähnliche Abwesenheit */
  creditedMinutes: number;
  actualMinutes: number;
  diffMinutes: number;
  holiday: string | null;
  labels: string[];
  sick: boolean;
  vacationFraction: number;
}

const DAY_MS = 86_400_000;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const dayKeyOf = (d: Date) => d.toISOString().slice(0, 10);

/** Gültiges Arbeitszeitmodell an einem Tag (jüngstes validFrom ≤ Tag) */
export function scheduleFor(schedules: ScheduleLike[], day: Date): ScheduleLike | null {
  let best: ScheduleLike | null = null;
  for (const s of schedules) if (s.validFrom <= day && (!best || s.validFrom > best.validFrom)) best = s;
  return best;
}

export function plannedMinutes(schedules: ScheduleLike[], day: Date): number {
  const s = scheduleFor(schedules, day);
  if (!s) return 0;
  return [s.sunMinutes, s.monMinutes, s.tueMinutes, s.wedMinutes, s.thuMinutes, s.friMinutes, s.satMinutes][day.getUTCDay()]!;
}

export function computeDay(input: DayInput): DayAccount {
  const key = dayKeyOf(input.day);
  const employed = input.day >= input.employmentStart && (!input.employmentEnd || input.day <= input.employmentEnd);
  const planned = employed ? plannedMinutes(input.schedules, input.day) : 0;
  const labels: string[] = [];
  const holiday = holidayName(key);

  let target = planned;
  let credited = 0;
  let vacationFraction = 0;

  if (holiday) {
    target = 0;
    labels.push(holiday);
  } else if (input.companyDay) {
    const c = input.companyDay;
    labels.push(c.name);
    if (c.kind === "BETRIEBSFERIEN" && c.countsAsVacation) {
      credited += planned; // wird als Urlaub verrechnet
      vacationFraction = planned > 0 ? 1 : 0;
    } else {
      target = Math.round(planned * c.targetFactor);
    }
  }

  let sick = false;
  if (target > 0 && input.sick) {
    sick = true;
    labels.push(input.sick.label);
    credited = target; // Krankheit: volle Soll-Zeit gutgeschrieben, kein Urlaubsabzug
  } else if (target > 0) {
    for (const a of input.absences ?? []) {
      const part = Math.round(target * a.fraction);
      labels.push(a.fraction < 1 ? `${a.label} (½)` : a.label);
      if (a.category === "UNBEZAHLT") target -= part; // Soll entfällt
      else if (a.creditsTarget) credited += part;
      // Freizeitausgleich: Soll bleibt, keine Gutschrift → Saldo sinkt
      if (a.category === "URLAUB") vacationFraction += a.fraction;
    }
    credited = Math.min(credited, target);
  }

  const r = input.roundingMinutes ?? 0;
  const worked = r > 0 ? Math.floor(input.workedMinutes / r) * r : input.workedMinutes;
  const actual = worked + credited;
  return {
    date: key,
    weekday: input.day.getUTCDay(),
    plannedMinutes: planned,
    targetMinutes: target,
    workedMinutes: worked,
    creditedMinutes: credited,
    actualMinutes: actual,
    diffMinutes: actual - target,
    holiday,
    labels,
    sick,
    vacationFraction,
  };
}

/** Ampel für den Zeitkonto-Saldo */
export function balanceLight(balanceMinutes: number, yellowHours: number, redHours: number): "gruen" | "gelb" | "rot" {
  const h = Math.abs(balanceMinutes) / 60;
  if (h >= redHours) return "rot";
  if (h >= yellowHours) return "gelb";
  return "gruen";
}
