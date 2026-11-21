import { describe, expect, it } from "vitest";
import { blocksFromSimple, validateBlocks } from "./blocks";

describe("Korrektur-Blöcke", () => {
  it("baut Blöcke aus Kommen/Gehen + Pausen", () => {
    expect(blocksFromSimple("7:00", "16:45", [{ von: "9:00", bis: "9:20" }, { von: "12:30", bis: "12:55" }])).toEqual([
      { kind: "ARBEIT", start: "07:00", end: "09:00" },
      { kind: "PAUSE", start: "09:00", end: "09:20" },
      { kind: "ARBEIT", start: "09:20", end: "12:30" },
      { kind: "PAUSE", start: "12:30", end: "12:55" },
      { kind: "ARBEIT", start: "12:55", end: "16:45" },
    ]);
    expect(blocksFromSimple("07:00", "15:00", [{ von: "", bis: "" }])).toEqual([{ kind: "ARBEIT", start: "07:00", end: "15:00" }]);
  });
  it("lehnt Unsinn ab", () => {
    expect(typeof blocksFromSimple("17:00", "07:00", [])).toBe("string"); // keine Nachtschicht
    expect(typeof blocksFromSimple("07:00", "15:00", [{ von: "16:00", bis: "16:30" }])).toBe("string");
    expect(typeof blocksFromSimple("7", "15:00", [])).toBe("string");
  });
  it("validiert Überschneidungen und offenen letzten Block", () => {
    expect(validateBlocks([{ kind: "ARBEIT", start: "07:00", end: "10:00" }, { kind: "ARBEIT", start: "09:00", end: "12:00" }])).toMatch(/überschneidet/);
    expect(validateBlocks([{ kind: "ARBEIT", start: "07:00", end: null }])).toMatch(/Ende fehlt/);
    expect(validateBlocks([{ kind: "ARBEIT", start: "07:00", end: null }], { allowOpenLast: true })).toBeNull();
    expect(validateBlocks([{ kind: "PAUSE", start: "07:00", end: "08:00" }])).toMatch(/beginnen/);
    expect(validateBlocks([])).toBeNull();
  });
});
