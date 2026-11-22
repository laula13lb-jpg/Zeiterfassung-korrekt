import { describe, expect, it } from "vitest";
import { daysWithin, mergePeriods, sickHints } from "./sick-rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const p = (a: string, b: string) => ({ start: d(a), end: d(b) });

describe("Krankheitszeiträume", () => {
  it("fasst anschließende Zeiträume zusammen (Verlängerung)", () => {
    expect(mergePeriods([p("2026-03-02", "2026-03-06"), p("2026-03-07", "2026-03-13"), p("2026-04-01", "2026-04-02")])).toEqual([
      p("2026-03-02", "2026-03-13"), p("2026-04-01", "2026-04-02"),
    ]);
  });
  it("zählt Kalendertage im Zeitfenster", () => {
    expect(daysWithin([p("2025-12-28", "2026-01-03")], d("2026-01-01"), d("2026-12-31"))).toBe(3);
  });
});

describe("Hinweise 6 Wochen (EFZG) und BEM", () => {
  const today = d("2026-11-22");
  it("6 Wochen am Stück", () => {
    const h = sickHints([p("2026-05-04", "2026-06-14")], today); // 42 Tage
    expect(h).toMatchObject({ longestEpisode: 42, efzgReached: true, bemRecommended: false });
  });
  it("wiederholt krank: mehr als 6 Wochen in 12 Monaten → BEM", () => {
    const h = sickHints([p("2026-01-05", "2026-01-23"), p("2026-04-13", "2026-04-30"), p("2026-09-07", "2026-09-14")], today);
    expect(h.efzgReached).toBe(false);
    expect(h.last12Months).toBe(19 + 18 + 8);
    expect(h.bemRecommended).toBe(true);
  });
  it("älter als 12 Monate zählt nicht, Zukunft auch nicht", () => {
    const h = sickHints([p("2025-09-01", "2025-11-15"), p("2026-11-20", "2026-12-04")], today);
    expect(h.last12Months).toBe(3);
    expect(h.efzgReached).toBe(true); // Episode 2025 (76 Tage)
  });
});
