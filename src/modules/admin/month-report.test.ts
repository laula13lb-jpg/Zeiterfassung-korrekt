import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/modules/zeiterfassung/account", () => ({ getMonthAccount: vi.fn() }));
import { PAYROLL_COLUMNS, toCsv, type MonthSummary } from "./month-report";

const row: MonthSummary = {
  employeeId: "x", personnelNo: "1003", name: "Becker, Max", firstName: "Max", lastName: "Becker", department: "Karosserie (inkl. Mechanik)",
  year: 2026, month: 11, targetMinutes: 9360, workedMinutes: 9000, creditedMinutes: 480, actualMinutes: 9480, diffMinutes: 120,
  openingBalance: 30, adjustmentMinutes: 0, closingBalance: 150, workDays: 19, vacationDays: 1.5, sickDays: 0, childSickDays: 0,
  holidayDays: 0, specialLeaveDays: 0, unpaidDays: 0, timeOffDays: 0, otherAbsenceDays: 0, breakDeductedMinutes: 45,
  notCreditedMinutes: 0, closedAt: null, employeeConfirmedAt: null,
};

describe("Lohnliste CSV", () => {
  it("Semikolon, Dezimalkomma, BOM, stabile Spaltenschlüssel", () => {
    const csv = toCsv([row]);
    expect(csv.startsWith("﻿Personalnummer;Nachname;Vorname;Abteilung;Monat;Soll (Std.)")).toBe(true);
    const line = csv.split("\r\n")[1]!;
    expect(line).toContain("1003;Becker;Max;Karosserie (inkl. Mechanik);2026-11;156;150;8;158;2;0;2,5;19;1,5;");
    expect(new Set(PAYROLL_COLUMNS.map((c) => c.key)).size).toBe(PAYROLL_COLUMNS.length);
  });
  it("maskiert Semikolons und Anführungszeichen", () => {
    expect(toCsv([{ ...row, department: 'Lack; "Spezial"' }])).toContain('"Lack; ""Spezial"""');
  });
});
