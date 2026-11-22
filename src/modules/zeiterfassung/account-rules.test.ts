import { describe, expect, it } from "vitest";
import { balanceLight, computeDay, plannedMinutes, type ScheduleLike } from "./account-rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const VOLLZEIT: ScheduleLike = { validFrom: d("2020-01-01"), monMinutes: 480, tueMinutes: 480, wedMinutes: 480, thuMinutes: 480, friMinutes: 420, satMinutes: 0, sunMinutes: 0 };
const base = { schedules: [VOLLZEIT], employmentStart: d("2020-01-01"), employmentEnd: null };

describe("Arbeitszeitmodell", () => {
  it("39 Std.: Mo–Do 8 Std., Fr 7 Std., Wochenende frei", () => {
    const week = ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"];
    expect(week.map((x) => plannedMinutes([VOLLZEIT], d(x)))).toEqual([480, 480, 480, 480, 420, 0, 0]);
    expect(week.reduce((a, x) => a + plannedMinutes([VOLLZEIT], d(x)), 0)).toBe(39 * 60);
  });
  it("Modellwechsel ab Datum (z. B. Wechsel in Teilzeit)", () => {
    const teil: ScheduleLike = { ...VOLLZEIT, validFrom: d("2026-04-01"), monMinutes: 300, friMinutes: 0 };
    expect(plannedMinutes([VOLLZEIT, teil], d("2026-03-30"))).toBe(480);
    expect(plannedMinutes([VOLLZEIT, teil], d("2026-04-06"))).toBe(300);
    expect(plannedMinutes([VOLLZEIT, teil], d("2026-04-03"))).toBe(0);
  });
});

describe("Soll/Ist pro Tag", () => {
  it("Normaler Tag mit Überstunden", () => {
    const r = computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 510 });
    expect(r).toMatchObject({ targetMinutes: 480, actualMinutes: 510, diffMinutes: 30 });
  });
  it("Feiertag: Soll 0, Arbeit am Feiertag zählt voll als Plus", () => {
    const r = computeDay({ ...base, day: d("2026-10-31"), workedMinutes: 0 }); // Reformationstag (Sa)
    expect(r.targetMinutes).toBe(0);
    const k = computeDay({ ...base, day: d("2026-04-03"), workedMinutes: 120 }); // Karfreitag
    expect(k).toMatchObject({ holiday: "Karfreitag", targetMinutes: 0, diffMinutes: 120 });
  });
  it("Heiligabend als halber Tag", () => {
    const r = computeDay({ ...base, day: d("2026-12-24"), workedMinutes: 240,
      companyDay: { date: d("2026-12-24"), kind: "HALBER_TAG", name: "Heiligabend", targetFactor: 0.5, countsAsVacation: false } });
    expect(r).toMatchObject({ plannedMinutes: 480, targetMinutes: 240, diffMinutes: 0 });
  });
  it("Betriebsferien als Urlaub verrechnet", () => {
    const r = computeDay({ ...base, day: d("2026-12-28"), workedMinutes: 0,
      companyDay: { date: d("2026-12-28"), kind: "BETRIEBSFERIEN", name: "Betriebsferien", targetFactor: 0, countsAsVacation: true } });
    expect(r).toMatchObject({ targetMinutes: 480, creditedMinutes: 480, diffMinutes: 0, vacationFraction: 1 });
  });
  it("Urlaub (ganz/halb) wird mit Soll gutgeschrieben", () => {
    const voll = computeDay({ ...base, day: d("2026-03-13"), workedMinutes: 0,
      absences: [{ label: "Urlaub", category: "URLAUB", creditsTarget: true, fraction: 1 }] });
    expect(voll).toMatchObject({ targetMinutes: 420, creditedMinutes: 420, diffMinutes: 0, vacationFraction: 1 });
    const halb = computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 240,
      absences: [{ label: "Urlaub", category: "URLAUB", creditsTarget: true, fraction: 0.5 }] });
    expect(halb).toMatchObject({ creditedMinutes: 240, actualMinutes: 480, diffMinutes: 0, vacationFraction: 0.5 });
  });
  it("Krankheit: Soll gutgeschrieben, kein Urlaubsabzug (auch während Urlaub)", () => {
    const r = computeDay({ ...base, day: d("2026-03-10"), workedMinutes: 0, sick: { label: "Krank" },
      absences: [{ label: "Urlaub", category: "URLAUB", creditsTarget: true, fraction: 1 }] });
    expect(r).toMatchObject({ creditedMinutes: 480, diffMinutes: 0, sick: true, vacationFraction: 0 });
  });
  it("Kind krank: Soll entfällt, keine Gutschrift, kein Minus", () => {
    const r = computeDay({ ...base, day: d("2026-03-10"), workedMinutes: 0, sick: { label: "Kind krank", childSick: true } });
    expect(r).toMatchObject({ targetMinutes: 0, creditedMinutes: 0, diffMinutes: 0 });
  });
  it("Krankheit am Wochenende/Feiertag ändert nichts", () => {
    const r = computeDay({ ...base, day: d("2026-03-14"), workedMinutes: 0, sick: { label: "Krank" } });
    expect(r).toMatchObject({ targetMinutes: 0, creditedMinutes: 0, sick: false });
  });
  it("Unbezahlter Urlaub: Soll entfällt", () => {
    const r = computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 0,
      absences: [{ label: "Unbezahlt", category: "UNBEZAHLT", creditsTarget: false, fraction: 1 }] });
    expect(r).toMatchObject({ targetMinutes: 0, diffMinutes: 0 });
  });
  it("Freizeitausgleich: Soll bleibt → Saldo sinkt", () => {
    const r = computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 0,
      absences: [{ label: "Freizeitausgleich", category: "FREIZEITAUSGLEICH", creditsTarget: false, fraction: 1 }] });
    expect(r.diffMinutes).toBe(-480);
  });
  it("Vor Eintritt / nach Austritt kein Soll", () => {
    const r = computeDay({ ...base, employmentStart: d("2026-04-01"), day: d("2026-03-31"), workedMinutes: 0 });
    expect(r.targetMinutes).toBe(0);
    const x = computeDay({ ...base, employmentEnd: d("2026-03-31"), day: d("2026-04-01"), workedMinutes: 0 });
    expect(x.targetMinutes).toBe(0);
  });
  it("Rundung nur wenn eingestellt", () => {
    expect(computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 487 }).workedMinutes).toBe(487);
    expect(computeDay({ ...base, day: d("2026-03-09"), workedMinutes: 487, roundingMinutes: 15 }).workedMinutes).toBe(480);
  });
});

describe("Ampel", () => {
  it("Grenzen", () => {
    expect(balanceLight(19 * 60, 20, 40)).toBe("gruen");
    expect(balanceLight(-20 * 60, 20, 40)).toBe("gelb");
    expect(balanceLight(41 * 60, 20, 40)).toBe("rot");
  });
});
