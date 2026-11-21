import { describe, expect, it } from "vitest";
import {
  allowedStamps, breakDeduction, greeting, isDuplicate, isStale, planStamp, requiredBreak, statusFromOpen, summarizeDay, type EntryLike,
} from "./rules";
import { berlinDay, berlinTimeOn, dayKey, fmtTime } from "@/lib/time";

/** Berliner Ortszeit → UTC-Date (für Tests mit fester Zeitzonenangabe) */
const t = (iso: string) => new Date(iso);
const W = (s: string, e: string | null): EntryLike => ({ kind: "ARBEIT", start: t(s), end: e ? t(e) : null });
const P = (s: string, e: string | null): EntryLike => ({ kind: "PAUSE", start: t(s), end: e ? t(e) : null });

describe("Status & erlaubte Stempelungen", () => {
  it("leitet Status aus offenem Eintrag ab", () => {
    expect(statusFromOpen(null)).toBe("ABWESEND");
    expect(statusFromOpen({ kind: "ARBEIT" })).toBe("ARBEIT");
    expect(statusFromOpen({ kind: "PAUSE" })).toBe("PAUSE");
  });
  it("erlaubt nur passende Aktionen", () => {
    expect(allowedStamps("ABWESEND")).toEqual(["KOMMEN"]);
    expect(allowedStamps("ARBEIT")).toEqual(["PAUSE_START", "GEHEN"]);
    expect(allowedStamps("PAUSE")).toEqual(["PAUSE_ENDE", "GEHEN"]);
  });
  it("plant Änderungen bzw. lehnt ab", () => {
    expect(planStamp("ABWESEND", "KOMMEN")).toEqual({ close: false, open: "ARBEIT" });
    expect(planStamp("ARBEIT", "PAUSE_START")).toEqual({ close: true, open: "PAUSE" });
    expect(planStamp("PAUSE", "PAUSE_ENDE")).toEqual({ close: true, open: "ARBEIT" });
    expect(planStamp("PAUSE", "GEHEN")).toEqual({ close: true, open: null });
    expect(planStamp("ARBEIT", "KOMMEN")).toHaveProperty("error");
    expect(planStamp("ABWESEND", "GEHEN")).toHaveProperty("error");
  });
});

describe("Pausenregeln §4 ArbZG", () => {
  it("Mindestpause nach Arbeitszeit", () => {
    expect(requiredBreak(360)).toBe(0); // genau 6 Std.
    expect(requiredBreak(361)).toBe(30);
    expect(requiredBreak(540)).toBe(30); // genau 9 Std.
    expect(requiredBreak(541)).toBe(45);
  });
  it("Abzug nur so weit wie nötig", () => {
    expect(breakDeduction(370, 0)).toBe(10); // 6:10 → 6:00
    expect(breakDeduction(420, 0)).toBe(30); // 7:00 → 6:30 mit 30 Min.
    expect(breakDeduction(560, 30)).toBe(15); // 9:20 mit 30 → +15
    expect(breakDeduction(550, 30)).toBe(10); // 9:10 mit 30 → 9:00, 30 reichen
    expect(breakDeduction(600, 45)).toBe(0);
    expect(breakDeduction(300, 0)).toBe(0);
  });
});

describe("Tageszusammenfassung", () => {
  it("Normaler Tag Mo: 7:00–16:45 mit 20 + 25 Min. Pause", () => {
    const s = summarizeDay([
      W("2026-03-02T07:00:00+01:00", "2026-03-02T09:00:00+01:00"),
      P("2026-03-02T09:00:00+01:00", "2026-03-02T09:20:00+01:00"),
      W("2026-03-02T09:20:00+01:00", "2026-03-02T12:30:00+01:00"),
      P("2026-03-02T12:30:00+01:00", "2026-03-02T12:55:00+01:00"),
      W("2026-03-02T12:55:00+01:00", "2026-03-02T16:45:00+01:00"),
    ]);
    expect(s.workMinutes).toBe(9 * 60);
    expect(s.breakMinutes).toBe(45);
    expect(s.qualifyingBreakMinutes).toBe(45);
    expect(s.missingBreakMinutes).toBe(0);
    expect(s.netWorkMinutes).toBe(540);
  });

  it("Fehlende Pause: Modus Hinweis zieht nichts ab, Modus Abzug (Standard) schon", () => {
    const e = [W("2026-03-03T07:00:00+01:00", "2026-03-03T15:00:00+01:00")];
    const h = summarizeDay(e, { mode: "hinweis" });
    expect(h.missingBreakMinutes).toBe(30);
    expect(h.netWorkMinutes).toBe(480);
    const a = summarizeDay(e, { mode: "abzug" });
    expect(a.deductedMinutes).toBe(30);
    expect(a.netWorkMinutes).toBe(450);
  });

  it("Pausen unter 15 Minuten zählen nicht für §4", () => {
    const s = summarizeDay([
      W("2026-03-04T07:00:00+01:00", "2026-03-04T10:00:00+01:00"),
      P("2026-03-04T10:00:00+01:00", "2026-03-04T10:10:00+01:00"),
      W("2026-03-04T10:10:00+01:00", "2026-03-04T14:10:00+01:00"),
    ]);
    expect(s.workMinutes).toBe(420);
    expect(s.breakMinutes).toBe(10);
    expect(s.qualifyingBreakMinutes).toBe(0);
    expect(s.missingBreakMinutes).toBe(30);
  });

  it("Lücke zwischen Gehen und Kommen zählt als Pause", () => {
    const s = summarizeDay([
      W("2026-03-05T07:00:00+01:00", "2026-03-05T12:00:00+01:00"),
      W("2026-03-05T12:30:00+01:00", "2026-03-05T16:00:00+01:00"),
    ]);
    expect(s.workMinutes).toBe(510);
    expect(s.breakMinutes).toBe(30);
    expect(s.missingBreakMinutes).toBe(0);
  });

  it("Offener Eintrag zählt bis jetzt (Pausenabzug schon eingerechnet)", () => {
    const s = summarizeDay([W("2026-03-06T07:00:00+01:00", null)], { now: t("2026-03-06T14:00:00+01:00") });
    expect(s.open).toBe(true);
    expect(s.workMinutes).toBe(420);
    expect(s.deductedMinutes).toBe(30);
    expect(s.netWorkMinutes).toBe(390);
  });

  it("Standard: nicht gestempelte Pause wird abgezogen", () => {
    // Mo 7:00–15:45 ohne Pause gestempelt → 8:45 Std., 30 Min. Pflichtpause → 8:15 Std.
    const s = summarizeDay([W("2026-03-09T07:00:00+01:00", "2026-03-09T15:45:00+01:00")]);
    expect(s.deductedMinutes).toBe(30);
    expect(s.netWorkMinutes).toBe(495);
  });

  it("Betriebliche Pausenregel: 45 Min. ab 6 Std.", () => {
    const rule = { kind: "betrieblich", afterMinutes: 360, breakMinutes: 45 } as const;
    const s = summarizeDay([W("2026-03-09T07:00:00+01:00", "2026-03-09T15:45:00+01:00")], { breakRule: rule });
    expect(s.requiredBreakMinutes).toBe(45);
    expect(s.netWorkMinutes).toBe(480); // 8:45 − 45 Min. = 8:00
    // mit gestempelten 20 + 25 Min. kein Abzug
    const ok = summarizeDay([
      W("2026-03-09T07:00:00+01:00", "2026-03-09T09:00:00+01:00"),
      P("2026-03-09T09:00:00+01:00", "2026-03-09T09:20:00+01:00"),
      W("2026-03-09T09:20:00+01:00", "2026-03-09T12:30:00+01:00"),
      P("2026-03-09T12:30:00+01:00", "2026-03-09T12:55:00+01:00"),
      W("2026-03-09T12:55:00+01:00", "2026-03-09T15:45:00+01:00"),
    ], { breakRule: rule });
    expect(ok.deductedMinutes).toBe(0);
    expect(ok.netWorkMinutes).toBe(480);
  });

  it("Zeit vor 6:00 Uhr wird nicht gutgeschrieben", () => {
    const creditFrom = t("2026-03-10T06:00:00+01:00");
    const s = summarizeDay([
      W("2026-03-10T05:30:00+01:00", "2026-03-10T09:00:00+01:00"),
      P("2026-03-10T09:00:00+01:00", "2026-03-10T09:20:00+01:00"),
      W("2026-03-10T09:20:00+01:00", "2026-03-10T12:30:00+01:00"),
      P("2026-03-10T12:30:00+01:00", "2026-03-10T12:55:00+01:00"),
      W("2026-03-10T12:55:00+01:00", "2026-03-10T14:45:00+01:00"),
    ], { creditFrom });
    expect(s.workMinutes).toBe(510); // tatsächlich 8:30 (für ArbZG-Prüfungen)
    expect(s.notCreditedMinutes).toBe(30);
    expect(s.netWorkMinutes).toBe(480); // gutgeschrieben 8:00
    // komplett vor 6 Uhr
    const early = summarizeDay([W("2026-03-10T05:00:00+01:00", "2026-03-10T05:45:00+01:00")], { creditFrom });
    expect(early.netWorkMinutes).toBe(0);
  });

  it("6:00 Uhr gilt in Sommer- und Winterzeit als Ortszeit", () => {
    expect(berlinTimeOn(new Date("2026-07-01T00:00:00Z"), "06:00").toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(berlinTimeOn(new Date("2026-01-15T00:00:00Z"), "06:00").toISOString()).toBe("2026-01-15T05:00:00.000Z");
  });

  it("Sommerzeit-Umstellung (29.03.2026): 22:00–06:00 sind nur 7 echte Stunden", () => {
    const s = summarizeDay([W("2026-03-28T22:00:00+01:00", "2026-03-29T06:00:00+02:00")]);
    expect(s.workMinutes).toBe(7 * 60);
  });

  it("Winterzeit-Umstellung (25.10.2026): 22:00–06:00 sind 9 echte Stunden", () => {
    const s = summarizeDay([W("2026-10-24T22:00:00+02:00", "2026-10-25T06:00:00+01:00")]);
    expect(s.workMinutes).toBe(9 * 60);
  });
});

describe("Zeitzone Europe/Berlin", () => {
  it("Arbeitstag nach Berliner Datum, nicht UTC", () => {
    // 00:30 Berliner Zeit = 22:30 UTC am Vortag
    expect(dayKey(berlinDay(t("2026-07-01T00:30:00+02:00")))).toBe("2026-07-01");
    expect(dayKey(berlinDay(t("2026-01-01T00:30:00+01:00")))).toBe("2026-01-01");
  });
  it("Anzeige in Ortszeit (Sommer/Winter)", () => {
    expect(fmtTime(t("2026-07-01T05:02:00Z"))).toBe("07:02");
    expect(fmtTime(t("2026-01-15T06:02:00Z"))).toBe("07:02");
  });
});

describe("Hilfsregeln", () => {
  it("keine Nachtschichten: offene Buchung vom Vortag = vergessen auszustempeln", () => {
    const today = berlinDay(t("2026-03-10T00:30:00+01:00"));
    expect(isStale({ workDate: new Date("2026-03-09T00:00:00Z") }, today)).toBe(true);
    expect(isStale({ workDate: new Date("2026-03-10T00:00:00Z") }, today)).toBe(false);
  });
  it("erkennt Doppeltippen", () => {
    const at = t("2026-03-10T07:00:00+01:00");
    expect(isDuplicate({ type: "KOMMEN", at }, "KOMMEN", new Date(at.getTime() + 5000))).toBe(true);
    expect(isDuplicate({ type: "KOMMEN", at }, "GEHEN", new Date(at.getTime() + 5000))).toBe(false);
  });
  it("Begrüßung", () => {
    expect(greeting("KOMMEN", 7)).toBe("Guten Morgen");
    expect(greeting("GEHEN", 16)).toBe("Schönen Feierabend");
  });
});
