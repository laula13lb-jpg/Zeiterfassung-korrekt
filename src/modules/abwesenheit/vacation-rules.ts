/**
 * Urlaubsberechnung (reine Logik, unit-getestet).
 * Kalendertage als Date um 00:00 UTC (wie @db.Date).
 */

const DAY_MS = 86_400_000;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const key = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Anteil eines Kalendertags, der als Urlaubstag zählt:
 * 0 = kein Arbeitstag (Wochenende, arbeitsfreier Tag, Feiertag, Betriebsruhe),
 * 0.5 = halber Arbeitstag (z. B. Heiligabend), 1 = normaler Arbeitstag.
 */
export type DayFactor = (day: Date) => number;

export interface RangeInput {
  start: Date;
  end: Date;
  halfDayStart?: boolean;
  halfDayEnd?: boolean;
}

/** Urlaubstage je Kalendertag (nur Tage mit Anteil > 0) */
export function expandRange(r: RangeInput, factor: DayFactor): { day: Date; days: number }[] {
  const out: { day: Date; days: number }[] = [];
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) {
    let f = factor(d);
    if (f <= 0) continue;
    const isStart = key(d) === key(r.start);
    const isEnd = key(d) === key(r.end);
    // halber Urlaubstag: höchstens 0,5 (an einem halben Arbeitstag bleibt es bei 0,5)
    if ((isStart && r.halfDayStart) || (isEnd && r.halfDayEnd)) f = Math.min(f, 0.5);
    out.push({ day: d, days: f });
  }
  return out;
}

export function countDays(r: RangeInput, factor: DayFactor): number {
  return expandRange(r, factor).reduce((s, x) => s + x.days, 0);
}

/**
 * Jahresanspruch: Basis (bei 5-Tage-Woche) umgerechnet auf die Arbeitstage pro Woche,
 * anteilig 1/12 je vollem Beschäftigungsmonat bei Ein-/Austritt im Jahr (§ 5 BUrlG).
 * Bruchteile ab 0,5 Tagen werden auf volle Tage aufgerundet, kleinere auf halbe Tage.
 */
export function proRataEntitlement(opts: {
  baseDays: number;
  workdaysPerWeek: number;
  year: number;
  entryDate: Date;
  exitDate: Date | null;
}): number {
  const full = (opts.baseDays * opts.workdaysPerWeek) / 5;
  const yStart = new Date(Date.UTC(opts.year, 0, 1));
  const yEnd = new Date(Date.UTC(opts.year, 11, 31));
  const from = opts.entryDate > yStart ? opts.entryDate : yStart;
  const to = opts.exitDate && opts.exitDate < yEnd ? opts.exitDate : yEnd;
  if (from > to) return 0;
  const months = fullMonths(from, to);
  const value = months >= 12 ? full : (full * months) / 12;
  return roundVacation(value);
}

/** Volle Kalendermonate (bzw. Monatszeiträume) zwischen zwei Tagen, beide einschließlich */
export function fullMonths(from: Date, to: Date): number {
  // Zählung ab Beginn: z. B. 15.03.–14.04. = 1 voller Monat
  let months = 0;
  let cursor = from;
  for (;;) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    if (addDays(next, -1) > to) break;
    months++;
    cursor = next;
    if (months >= 12) break;
  }
  return months;
}

export function roundVacation(v: number): number {
  const whole = Math.floor(v + 1e-9);
  const frac = v - whole;
  if (frac < 1e-9) return whole;
  return frac >= 0.5 ? whole + 1 : whole + 0.5;
}

export interface YearInput {
  year: number;
  entitlement: number;
  /** manueller Übertrag (z. B. Übernahme aus altem System); überschreibt die Berechnung */
  carryOverOverride: number | null;
  /** genommene/geplante Urlaubstage je Tag in diesem Jahr (genehmigt) */
  taken: { day: Date; days: number }[];
}

export interface YearBalance {
  year: number;
  entitlement: number;
  carryIn: number;
  /** Verfallsdatum des Übertrags */
  expiry: Date | null;
  /** bereits verfallene Tage (nur nach dem Verfallsdatum) */
  expired: number;
  /** Übertrag, der bis zum Verfall noch genommen werden muss */
  carryRemaining: number;
  /** genehmigte Urlaubstage in diesem Jahr (vergangen + geplant) */
  taken: number;
  /** verbleibender Urlaub */
  remaining: number;
}

/**
 * Urlaubskonto über mehrere Jahre: Rest wird übertragen und verfällt (optional) zum
 * Stichtag, soweit er bis dahin nicht genommen wurde. Genommener Urlaub verbraucht
 * zuerst den Übertrag.
 */
export function vacationBalances(
  years: YearInput[],
  opts: {
    today: Date;
    expiryMonthDay: string | null;
    /** Beginn der Erfassung in der App: Stichtage davor lösen keinen Verfall aus (Übernahme beim Start) */
    trackedFrom?: Date;
  },
): YearBalance[] {
  const out: YearBalance[] = [];
  let prevRemaining = 0;
  for (const [i, y] of [...years].sort((a, b) => a.year - b.year).entries()) {
    const carryIn = y.carryOverOverride ?? (i === 0 ? 0 : Math.max(0, prevRemaining));
    const rawExpiry = opts.expiryMonthDay ? new Date(`${y.year}-${opts.expiryMonthDay}T00:00:00Z`) : null;
    const expiry = rawExpiry && (!opts.trackedFrom || rawExpiry >= opts.trackedFrom) ? rawExpiry : null;
    const taken = y.taken.reduce((s, t) => s + t.days, 0);
    const takenUntilExpiry = expiry ? y.taken.filter((t) => t.day <= expiry).reduce((s, t) => s + t.days, 0) : taken;
    const unusedCarry = Math.max(0, carryIn - takenUntilExpiry);
    const expired = expiry && opts.today > expiry ? unusedCarry : 0;
    const remaining = y.entitlement + carryIn - taken - expired;
    out.push({
      year: y.year,
      entitlement: y.entitlement,
      carryIn,
      expiry,
      expired,
      carryRemaining: expiry && opts.today <= expiry ? unusedCarry : 0,
      taken,
      remaining,
    });
    prevRemaining = remaining;
  }
  return out;
}
