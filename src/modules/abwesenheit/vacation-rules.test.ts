import { describe, expect, it } from "vitest";
import { holidayName } from "@/modules/zeiterfassung/holidays";
import { countDays, expandRange, fullMonths, proRataEntitlement, roundVacation, vacationBalances } from "./vacation-rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const k = (x: Date) => x.toISOString().slice(0, 10);
/** Vollzeit Mo–Fr, Feiertage NI, Heiligabend/Silvester halbe Tage */
const vollzeit = (day: Date) => {
  const wd = day.getUTCDay();
  if (wd === 0 || wd === 6 || holidayName(k(day))) return 0;
  if (["12-24", "12-31"].includes(k(day).slice(5))) return 0.5;
  return 1;
};
/** Teilzeit Mo–Do */
const moDo = (day: Date) => (day.getUTCDay() === 5 ? 0 : vollzeit(day));

describe("Urlaubstage berechnen", () => {
  it("ohne Wochenenden", () => {
    expect(countDays({ start: d("2026-03-09"), end: d("2026-03-20") }, vollzeit)).toBe(10);
  });
  it("ohne Feiertage (Ostern 2026)", () => {
    // 30.03.–10.04.2026: Karfreitag 03.04. und Ostermontag 06.04. zählen nicht
    expect(countDays({ start: d("2026-03-30"), end: d("2026-04-10") }, vollzeit)).toBe(8);
  });
  it("Reformationstag und Tag der Deutschen Einheit", () => {
    expect(countDays({ start: d("2027-10-25"), end: d("2027-11-05") }, vollzeit)).toBe(10); // 31.10.2027 ist Sonntag
    expect(countDays({ start: d("2028-10-30"), end: d("2028-11-03") }, vollzeit)).toBe(4); // Di 31.10.2028
  });
  it("halbe Tage am Anfang/Ende", () => {
    expect(countDays({ start: d("2026-03-09"), end: d("2026-03-13"), halfDayStart: true }, vollzeit)).toBe(4.5);
    expect(countDays({ start: d("2026-03-09"), end: d("2026-03-09"), halfDayStart: true }, vollzeit)).toBe(0.5);
    expect(countDays({ start: d("2026-03-09"), end: d("2026-03-13"), halfDayStart: true, halfDayEnd: true }, vollzeit)).toBe(4);
  });
  it("Weihnachten: Heiligabend/Silvester halb, Feiertage frei", () => {
    // 21.12.2026 (Mo) – 01.01.2027 (Fr): 21,22,23 =3; 24 = 0,5; 25/26 Feiertag; 28,29,30 = 3; 31 = 0,5; 1.1. Feiertag
    expect(countDays({ start: d("2026-12-21"), end: d("2027-01-01") }, vollzeit)).toBe(7);
  });
  it("arbeitsfreie Tage der Teilzeitkraft zählen nicht", () => {
    expect(countDays({ start: d("2026-03-09"), end: d("2026-03-15") }, moDo)).toBe(4);
  });
  it("Aufteilung über den Jahreswechsel", () => {
    const days = expandRange({ start: d("2026-12-28"), end: d("2027-01-08") }, vollzeit);
    const y26 = days.filter((x) => x.day.getUTCFullYear() === 2026).reduce((s, x) => s + x.days, 0);
    const y27 = days.filter((x) => x.day.getUTCFullYear() === 2027).reduce((s, x) => s + x.days, 0);
    expect([y26, y27]).toEqual([3.5, 5]);
  });
});

describe("Anspruch", () => {
  it("30 Tage bei 5-Tage-Woche, anteilig bei weniger Arbeitstagen", () => {
    const base = { baseDays: 30, year: 2026, entryDate: d("2020-01-01"), exitDate: null };
    expect(proRataEntitlement({ ...base, workdaysPerWeek: 5 })).toBe(30);
    expect(proRataEntitlement({ ...base, workdaysPerWeek: 4 })).toBe(24);
    expect(proRataEntitlement({ ...base, workdaysPerWeek: 3 })).toBe(18);
  });
  it("Eintritt/Austritt im Jahr: 1/12 je vollem Monat", () => {
    expect(proRataEntitlement({ baseDays: 30, workdaysPerWeek: 5, year: 2026, entryDate: d("2026-04-01"), exitDate: null })).toBe(23); // 22,5 → aufgerundet (§ 5 Abs. 2 BUrlG)
    expect(proRataEntitlement({ baseDays: 30, workdaysPerWeek: 5, year: 2026, entryDate: d("2026-03-15"), exitDate: null })).toBe(23); // 9 volle Monate
    expect(proRataEntitlement({ baseDays: 30, workdaysPerWeek: 5, year: 2026, entryDate: d("2020-01-01"), exitDate: d("2026-06-30") })).toBe(15);
    expect(proRataEntitlement({ baseDays: 30, workdaysPerWeek: 5, year: 2027, entryDate: d("2020-01-01"), exitDate: d("2026-06-30") })).toBe(0);
  });
  it("Rundung", () => {
    expect(roundVacation(12.5)).toBe(13);
    expect(roundVacation(12)).toBe(12);
    expect(roundVacation(12.6)).toBe(13);
    expect(roundVacation(12.2)).toBe(12.5);
    expect(fullMonths(d("2026-01-01"), d("2026-12-31"))).toBe(12);
  });
});

describe("Übertrag und Verfall", () => {
  const years = (taken27: { day: Date; days: number }[]) => [
    { year: 2026, entitlement: 30, carryOverOverride: 4, taken: [{ day: d("2026-02-01"), days: 26 }] },
    { year: 2027, entitlement: 30, carryOverOverride: null, taken: taken27 },
  ];
  it("Rest wird übertragen (inkl. Übernahme aus Altsystem)", () => {
    const [y26, y27] = vacationBalances(years([]), { today: d("2027-01-10"), expiryMonthDay: "03-31" });
    expect(y26).toMatchObject({ carryIn: 4, taken: 26, remaining: 8 });
    expect(y27).toMatchObject({ carryIn: 8, carryRemaining: 8, expired: 0, remaining: 38 });
  });
  it("nicht genommener Übertrag verfällt nach dem 31.03.", () => {
    const b = vacationBalances(years([{ day: d("2027-02-15"), days: 5 }]), { today: d("2027-04-01"), expiryMonthDay: "03-31" });
    expect(b[1]).toMatchObject({ carryIn: 8, expired: 3, remaining: 30 });
  });
  it("Urlaub nach dem Stichtag rettet den Übertrag nicht", () => {
    const b = vacationBalances(years([{ day: d("2027-04-10"), days: 5 }]), { today: d("2027-04-20"), expiryMonthDay: "03-31" });
    expect(b[1]).toMatchObject({ expired: 8, remaining: 25 });
  });
  it("Übernahme beim Start nach dem Stichtag verfällt nicht im Startjahr", () => {
    const b = vacationBalances([{ year: 2026, entitlement: 30, carryOverOverride: 3, taken: [] }], { today: d("2026-11-22"), expiryMonthDay: "03-31", trackedFrom: d("2026-11-01") });
    expect(b[0]).toMatchObject({ carryIn: 3, expired: 0, remaining: 33 });
  });
  it("ohne Verfall bleibt der Übertrag", () => {
    const b = vacationBalances(years([]), { today: d("2027-06-01"), expiryMonthDay: null });
    expect(b[1]).toMatchObject({ expired: 0, remaining: 38 });
  });
});
