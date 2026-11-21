import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export const TZ = "Europe/Berlin";

/** Zeitpunkt (UTC) als Berliner Ortszeit-Datum */
export function inBerlin(d: Date | number): TZDate {
  return new TZDate(typeof d === "number" ? d : d.getTime(), TZ);
}

/** Formatierung in deutscher Schreibweise und Berliner Zeit */
export function fmt(d: Date | number, pattern: string): string {
  return format(inBerlin(d), pattern, { locale: de });
}

export const fmtTime = (d: Date | number) => fmt(d, "HH:mm");
export const fmtDate = (d: Date | number) => fmt(d, "dd.MM.yyyy");
export const fmtDateTime = (d: Date | number) => fmt(d, "dd.MM.yyyy HH:mm");

/**
 * Kalendertag (Europe/Berlin) eines Zeitpunkts als Date für @db.Date-Felder
 * (Mitternacht UTC dieses Kalendertags, so wie Prisma DATE-Spalten abbildet).
 */
export function berlinDay(d: Date | number = new Date()): Date {
  const z = inBerlin(d);
  return new Date(Date.UTC(z.getFullYear(), z.getMonth(), z.getDate()));
}

/** "YYYY-MM-DD" eines @db.Date-Werts */
export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/** Minuten als "7:05 Std." bzw. "-0:30 Std." */
export function fmtMinutes(min: number, withUnit = true): string {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, "0")}${withUnit ? " Std." : ""}`;
}
