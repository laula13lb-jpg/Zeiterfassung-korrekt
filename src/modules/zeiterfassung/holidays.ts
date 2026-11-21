/**
 * Gesetzliche Feiertage in Niedersachsen (ohne externe Dienste berechnet).
 * Tage werden als "YYYY-MM-DD" (Kalendertag) geliefert.
 */

/** Ostersonntag nach der Gaußschen Osterformel (Meeus/Jones/Butcher) */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const key = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export interface Holiday {
  date: string;
  name: string;
}

export function holidaysNiedersachsen(year: number): Holiday[] {
  const e = easterSunday(year);
  const easter = utc(year, e.month, e.day);
  const list: Holiday[] = [
    { date: key(utc(year, 1, 1)), name: "Neujahr" },
    { date: key(addDays(easter, -2)), name: "Karfreitag" },
    { date: key(addDays(easter, 1)), name: "Ostermontag" },
    { date: key(utc(year, 5, 1)), name: "Tag der Arbeit" },
    { date: key(addDays(easter, 39)), name: "Christi Himmelfahrt" },
    { date: key(addDays(easter, 50)), name: "Pfingstmontag" },
    { date: key(utc(year, 10, 3)), name: "Tag der Deutschen Einheit" },
    // Reformationstag ist in Niedersachsen seit 2018 gesetzlicher Feiertag
    ...(year >= 2018 ? [{ date: key(utc(year, 10, 31)), name: "Reformationstag" }] : []),
    { date: key(utc(year, 12, 25)), name: "1. Weihnachtstag" },
    { date: key(utc(year, 12, 26)), name: "2. Weihnachtstag" },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

const cache = new Map<number, Map<string, string>>();

/** Name des Feiertags oder null */
export function holidayName(dateKey: string): string | null {
  const year = Number(dateKey.slice(0, 4));
  let m = cache.get(year);
  if (!m) {
    m = new Map(holidaysNiedersachsen(year).map((h) => [h.date, h.name]));
    cache.set(year, m);
  }
  return m.get(dateKey) ?? null;
}
