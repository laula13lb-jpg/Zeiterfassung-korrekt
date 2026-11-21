import { describe, expect, it } from "vitest";
import { easterSunday, holidayName, holidaysNiedersachsen } from "./holidays";

describe("Feiertage Niedersachsen", () => {
  it("Ostersonntag", () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
  });
  it("2026 vollständig", () => {
    expect(holidaysNiedersachsen(2026)).toEqual([
      { date: "2026-01-01", name: "Neujahr" },
      { date: "2026-04-03", name: "Karfreitag" },
      { date: "2026-04-06", name: "Ostermontag" },
      { date: "2026-05-01", name: "Tag der Arbeit" },
      { date: "2026-05-14", name: "Christi Himmelfahrt" },
      { date: "2026-05-25", name: "Pfingstmontag" },
      { date: "2026-10-03", name: "Tag der Deutschen Einheit" },
      { date: "2026-10-31", name: "Reformationstag" },
      { date: "2026-12-25", name: "1. Weihnachtstag" },
      { date: "2026-12-26", name: "2. Weihnachtstag" },
    ]);
  });
  it("Reformationstag, keine Feiertage anderer Länder", () => {
    expect(holidayName("2027-10-31")).toBe("Reformationstag");
    expect(holidayName("2026-06-04")).toBeNull(); // Fronleichnam – nicht in NI
    expect(holidayName("2026-11-01")).toBeNull(); // Allerheiligen – nicht in NI
    expect(holidayName("2026-11-18")).toBeNull(); // Buß- und Bettag – nur Sachsen
  });
});
