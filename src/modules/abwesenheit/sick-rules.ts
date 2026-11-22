/**
 * Auswertungen Krankheit (reine Logik). Gespeichert werden nur Zeiträume –
 * ob es sich um „dieselbe Erkrankung“ handelt, kann die App bewusst nicht wissen.
 */
const DAY_MS = 86_400_000;

export interface Period {
  start: Date;
  end: Date;
}

/** Überlappende oder direkt aneinander anschließende Zeiträume zusammenfassen */
export function mergePeriods(periods: Period[]): Period[] {
  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Period[] = [];
  for (const p of sorted) {
    const last = out.at(-1);
    if (last && p.start.getTime() <= last.end.getTime() + DAY_MS) {
      if (p.end > last.end) last.end = p.end;
    } else out.push({ start: p.start, end: p.end });
  }
  return out;
}

export const calendarDays = (p: Period) => Math.round((p.end.getTime() - p.start.getTime()) / DAY_MS) + 1;

/** Kalendertage im Zeitfenster [from, to] */
export function daysWithin(periods: Period[], from: Date, to: Date): number {
  let n = 0;
  for (const p of mergePeriods(periods)) {
    const s = p.start > from ? p.start : from;
    const e = p.end < to ? p.end : to;
    if (e >= s) n += calendarDays({ start: s, end: e });
  }
  return n;
}

export interface SickHints {
  /** längster zusammenhängender Zeitraum (Kalendertage) */
  longestEpisode: number;
  /** 6 Wochen am Stück → Entgeltfortzahlung (§ 3 EFZG) endet ggf. */
  efzgReached: boolean;
  /** Kalendertage krank in den letzten 12 Monaten */
  last12Months: number;
  /** > 6 Wochen in 12 Monaten → Angebot Betriebliches Eingliederungsmanagement (§ 167 Abs. 2 SGB IX) */
  bemRecommended: boolean;
}

export function sickHints(periods: Period[], today: Date): SickHints {
  const episodes = mergePeriods(periods.map((p) => ({ start: p.start, end: p.end < today ? p.end : today })).filter((p) => p.start <= today));
  const longest = Math.max(0, ...episodes.map(calendarDays));
  const yearAgo = new Date(today.getTime() - 364 * DAY_MS);
  const last12 = daysWithin(episodes, yearAgo, today);
  return { longestEpisode: longest, efzgReached: longest >= 42, last12Months: last12, bemRecommended: last12 > 42 };
}
