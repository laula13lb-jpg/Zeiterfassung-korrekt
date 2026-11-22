import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { anonymizeDue } from "./retention";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
describe("Aufbewahrungsfrist", () => {
  it("läuft bis Ende des Austrittsjahres + N Jahre", () => {
    expect(anonymizeDue(d("2026-03-31"), 6, d("2032-12-31"))).toBe(false);
    expect(anonymizeDue(d("2026-03-31"), 6, d("2033-01-01"))).toBe(true);
    expect(anonymizeDue(d("2026-12-31"), 2, d("2028-12-31"))).toBe(false);
  });
});
