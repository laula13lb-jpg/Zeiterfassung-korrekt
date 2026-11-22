import { describe, expect, it } from "vitest";
import { awToMinutes, minutesToAw, sollIst, splitAw } from "./types";

describe("[Aufträge] Arbeitswerte", () => {
  it("AW ↔ Minuten", () => {
    expect(awToMinutes(10)).toBe(60);
    expect(awToMinutes(10, 5)).toBe(50);
    expect(minutesToAw(45)).toBe(7.5);
  });
  it("Lack-AW frei aufteilen", () => {
    expect(splitAw(23, [{ workArea: "Vorarbeit", percent: 40 }, { workArea: "Lackierung", percent: 35 }, { workArea: "Finish", percent: 25 }])).toEqual([
      { workArea: "Vorarbeit", aw: 9.2 }, { workArea: "Lackierung", aw: 8.1 }, { workArea: "Finish", aw: 5.7 },
    ]);
    expect(typeof splitAw(10, [{ workArea: "Vorarbeit", percent: 50 }])).toBe("string");
  });
  it("Soll/Ist pro Abteilung und Arbeitsbereich, nur produktive Zeit", () => {
    const pos = [
      { id: "p1", departmentId: "karo", description: "Tür instand setzen", soldAw: 30 },
      { id: "p2", departmentId: "lack", workArea: "Vorarbeit", description: "Lack Vorarbeit", soldAw: 10 },
      { id: "p3", departmentId: "lack", workArea: "Lackierung", description: "Lackierung", soldAw: 12 },
    ];
    const rows = sollIst(pos, [
      { orderPositionId: "p1", departmentId: "karo", minutes: 200, productive: true },
      { orderPositionId: "p2", departmentId: "lack", minutes: 60, productive: true },
      { orderPositionId: null, departmentId: "lack", minutes: 30, productive: false },
    ]);
    expect(rows.find((r) => r.key === "karo")).toMatchObject({ sollMinutes: 180, istMinutes: 200, efficiency: 0.9 });
    expect(rows.find((r) => r.key === "lack/Vorarbeit")).toMatchObject({ sollMinutes: 60, istMinutes: 60, efficiency: 1 });
    expect(rows.find((r) => r.key === "lack/Lackierung")).toMatchObject({ istMinutes: 0, efficiency: null });
  });
});
