import { describe, expect, it } from "vitest";
import { afterFailure, isLocked, MAX_FAILED, remainingLockMinutes } from "./lockout";

describe("Sperre nach Fehlversuchen", () => {
  const t0 = new Date("2026-03-01T07:00:00Z");

  it("sperrt nach 5 Fehlversuchen für 5 Minuten", () => {
    let s = { failedCount: 0, lockedUntil: null as Date | null };
    for (let i = 0; i < MAX_FAILED - 1; i++) s = afterFailure(s, t0);
    expect(isLocked(s, t0)).toBe(false);
    s = afterFailure(s, t0);
    expect(isLocked(s, t0)).toBe(true);
    expect(remainingLockMinutes(s, t0)).toBe(5);
    expect(isLocked(s, new Date(t0.getTime() + 5 * 60_000 + 1))).toBe(false);
  });

  it("beginnt nach abgelaufener Sperre neu zu zählen", () => {
    const locked = { failedCount: 5, lockedUntil: new Date(t0.getTime() + 60_000) };
    const later = new Date(t0.getTime() + 10 * 60_000);
    const s = afterFailure(locked, later);
    expect(s.failedCount).toBe(1);
    expect(isLocked(s, later)).toBe(false);
  });
});
