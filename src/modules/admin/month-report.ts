import "server-only";
import { db } from "@/lib/db";
import { getMonthAccount, type MonthAccount } from "@/modules/zeiterfassung/account";

export interface MonthSummary {
  employeeId: string;
  personnelNo: string;
  name: string;
  firstName: string;
  lastName: string;
  department: string;
  year: number;
  month: number;
  targetMinutes: number;
  workedMinutes: number;
  creditedMinutes: number;
  actualMinutes: number;
  diffMinutes: number;
  openingBalance: number;
  adjustmentMinutes: number;
  closingBalance: number;
  workDays: number;
  vacationDays: number;
  sickDays: number;
  childSickDays: number;
  holidayDays: number;
  specialLeaveDays: number;
  unpaidDays: number;
  timeOffDays: number;
  otherAbsenceDays: number;
  breakDeductedMinutes: number;
  notCreditedMinutes: number;
  closedAt: Date | null;
  employeeConfirmedAt: Date | null;
}

/** Monatswerte einer Person (nur abgeschlossene Tage, also bis gestern) */
export async function monthSummary(employeeId: string, year: number, month: number, acc?: MonthAccount): Promise<MonthSummary> {
  const [emp, closing] = await Promise.all([
    db.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { department: true } }),
    db.monthClosing.findUnique({ where: { employeeId_year_month: { employeeId, year, month } } }),
  ]);
  const a = acc ?? (await getMonthAccount(employeeId, year, month));
  const days = a.days.filter((d) => !d.pending);
  const sumParts = (cats: string[]) =>
    days.reduce((s, d) => s + d.absenceParts.filter((p) => cats.includes(p.category)).reduce((x, p) => x + p.fraction, 0), 0);
  return {
    employeeId,
    personnelNo: emp.personnelNo,
    name: `${emp.lastName}, ${emp.firstName}`,
    firstName: emp.firstName,
    lastName: emp.lastName,
    department: emp.department?.name ?? "",
    year,
    month,
    targetMinutes: a.targetSum,
    workedMinutes: days.reduce((s, d) => s + d.workedMinutes, 0),
    creditedMinutes: days.reduce((s, d) => s + d.creditedMinutes, 0),
    actualMinutes: a.actualSum,
    diffMinutes: a.diffSum,
    openingBalance: a.openingBalance,
    adjustmentMinutes: a.adjustmentSum,
    closingBalance: a.closingBalance,
    workDays: days.filter((d) => d.workedMinutes > 0).length,
    vacationDays: days.reduce((s, d) => s + d.vacationFraction, 0),
    sickDays: days.filter((d) => d.sick).length,
    childSickDays: days.filter((d) => d.childSick).length,
    holidayDays: days.filter((d) => d.holidayOnWorkday).length,
    specialLeaveDays: sumParts(["SONDERURLAUB"]),
    unpaidDays: sumParts(["UNBEZAHLT"]),
    timeOffDays: sumParts(["FREIZEITAUSGLEICH"]),
    otherAbsenceDays: sumParts(["SONSTIGE"]),
    breakDeductedMinutes: days.reduce((s, d) => s + (d.summary?.deductedMinutes ?? 0), 0),
    notCreditedMinutes: days.reduce((s, d) => s + (d.summary?.notCreditedMinutes ?? 0), 0),
    closedAt: closing && !closing.reopenedAt ? closing.closedAt : null,
    employeeConfirmedAt: closing && !closing.reopenedAt ? closing.employeeConfirmedAt : null,
  };
}

const h = (min: number) => Math.round((min / 60) * 100) / 100;

/**
 * Spalten der Lohnliste. `key` ist stabil und dient später als Zuordnung zu DATEV-Lohnarten
 * (siehe docs/modul-auftraege.md bzw. README „DATEV“): pro Spalte kann eine Lohnart-Nummer
 * hinterlegt werden, ohne die Auswertung zu ändern.
 */
export const PAYROLL_COLUMNS: { key: string; label: string; unit: "text" | "std" | "tage"; value: (s: MonthSummary) => string | number }[] = [
  { key: "personalnummer", label: "Personalnummer", unit: "text", value: (s) => s.personnelNo },
  { key: "nachname", label: "Nachname", unit: "text", value: (s) => s.lastName },
  { key: "vorname", label: "Vorname", unit: "text", value: (s) => s.firstName },
  { key: "abteilung", label: "Abteilung", unit: "text", value: (s) => s.department },
  { key: "monat", label: "Monat", unit: "text", value: (s) => `${s.year}-${String(s.month).padStart(2, "0")}` },
  { key: "soll_std", label: "Soll (Std.)", unit: "std", value: (s) => h(s.targetMinutes) },
  { key: "gearbeitet_std", label: "Gearbeitet (Std.)", unit: "std", value: (s) => h(s.workedMinutes) },
  { key: "gutschrift_std", label: "Gutschrift Abwesenheit (Std.)", unit: "std", value: (s) => h(s.creditedMinutes) },
  { key: "ist_std", label: "Ist gesamt (Std.)", unit: "std", value: (s) => h(s.actualMinutes) },
  { key: "ueberstunden_monat_std", label: "Mehr-/Minderstunden Monat (Std.)", unit: "std", value: (s) => h(s.diffMinutes) },
  { key: "kontobuchungen_std", label: "Buchungen Zeitkonto (Std.)", unit: "std", value: (s) => h(s.adjustmentMinutes) },
  { key: "saldo_std", label: "Saldo Zeitkonto Monatsende (Std.)", unit: "std", value: (s) => h(s.closingBalance) },
  { key: "arbeitstage", label: "Anwesenheitstage", unit: "tage", value: (s) => s.workDays },
  { key: "urlaub_tage", label: "Urlaub (Tage)", unit: "tage", value: (s) => s.vacationDays },
  { key: "krank_tage", label: "Krank (Tage)", unit: "tage", value: (s) => s.sickDays },
  { key: "kind_krank_tage", label: "Kind krank (Tage)", unit: "tage", value: (s) => s.childSickDays },
  { key: "feiertag_tage", label: "Feiertage (Tage)", unit: "tage", value: (s) => s.holidayDays },
  { key: "sonderurlaub_tage", label: "Sonderurlaub (Tage)", unit: "tage", value: (s) => s.specialLeaveDays },
  { key: "unbezahlt_tage", label: "Unbezahlter Urlaub (Tage)", unit: "tage", value: (s) => s.unpaidDays },
  { key: "freizeitausgleich_tage", label: "Freizeitausgleich (Tage)", unit: "tage", value: (s) => s.timeOffDays },
  { key: "sonstige_tage", label: "Sonstige Abwesenheit (Tage)", unit: "tage", value: (s) => s.otherAbsenceDays },
  { key: "abgeschlossen", label: "Monat abgeschlossen", unit: "text", value: (s) => (s.closedAt ? "ja" : "nein") },
];

/** CSV für Excel (Semikolon, Dezimalkomma, UTF-8 mit BOM) */
export function toCsv(rows: MonthSummary[]): string {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? v.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 2 }) : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [PAYROLL_COLUMNS.map((c) => esc(c.label)).join(";"), ...rows.map((r) => PAYROLL_COLUMNS.map((c) => esc(c.value(r))).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export async function payrollRows(year: number, month: number): Promise<MonthSummary[]> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const emps = await db.employee.findMany({
    where: { tracksTime: true, entryDate: { lte: last }, OR: [{ exitDate: null }, { exitDate: { gte: first } }], anonymizedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return Promise.all(emps.map((e) => monthSummary(e.id, year, month)));
}
