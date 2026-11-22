import "server-only";
import PDFDocument from "pdfkit";
import { fmtDateTime, fmtMinutes, fmtTime, monthName } from "@/lib/time";
import { getMonthAccount } from "@/modules/zeiterfassung/account";
import { monthSummary } from "./month-report";

const BLUE = "#0a3a82";
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const hm = (m: number) => fmtMinutes(m, false);
const sg = (m: number) => (m > 0 ? "+" : "") + hm(m);
const days = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Monatsnachweis Arbeitszeit als PDF (zum Ausdrucken/Ablegen) – Standardschriften, keine externen Ressourcen */
export async function monthReportPdf(employeeId: string, year: number, month: number): Promise<Buffer> {
  const acc = await getMonthAccount(employeeId, year, month);
  const s = await monthSummary(employeeId, year, month, acc);

  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 40, right: 40 }, info: { Title: `Monatsnachweis ${monthName(year, month)} – ${s.firstName} ${s.lastName}`, Author: "Autoklinik Bludau" } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // Kopf
  doc.rect(40, 40, 515, 46).fill(BLUE);
  doc.fillColor("#ffcc00").font("Helvetica-Bold").fontSize(15).text("Autoklinik Bludau", 52, 50);
  doc.fillColor("#ffffff").font("Helvetica").fontSize(9).text("Bludau GmbH · Wodanstraße 38 · 38106 Braunschweig", 52, 69);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text(`Monatsnachweis ${monthName(year, month)}`, 300, 56, { width: 245, align: "right" });

  doc.fillColor("#000000").font("Helvetica").fontSize(10);
  doc.text(`Name: ${s.firstName} ${s.lastName}`, 40, 100);
  doc.text(`Personalnummer: ${s.personnelNo}`, 40, 114);
  doc.text(`Abteilung: ${s.department || "–"}`, 300, 100);
  doc.text(s.closedAt ? `Abgeschlossen: ${fmtDateTime(s.closedAt)}` : "Status: vorläufig (nicht abgeschlossen)", 300, 114);

  // Tabelle
  const cols = [
    { t: "Tag", w: 62, a: "left" as const },
    { t: "Kommen", w: 46, a: "right" as const },
    { t: "Gehen", w: 46, a: "right" as const },
    { t: "Pause", w: 40, a: "right" as const },
    { t: "Soll", w: 42, a: "right" as const },
    { t: "Ist", w: 42, a: "right" as const },
    { t: "Diff.", w: 44, a: "right" as const },
    { t: "Bemerkung", w: 193, a: "left" as const },
  ];
  let y = 138;
  const row = (vals: string[], opts: { bold?: boolean; fill?: string; color?: string } = {}) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    if (opts.fill) doc.rect(40, y - 2, 515, 13).fill(opts.fill);
    doc.fillColor(opts.color ?? "#000000").font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    let x = 40;
    vals.forEach((v, i) => {
      const pad = i === cols.length - 1 ? 10 : 2; // Abstand zwischen „Diff.“ und „Bemerkung“
      doc.text(v, x + pad, y, { width: cols[i]!.w - pad - 2, align: cols[i]!.a, lineBreak: false, ellipsis: true });
      x += cols[i]!.w;
    });
    y += 13;
  };
  row(cols.map((c) => c.t), { bold: true, fill: BLUE, color: "#ffffff" });
  for (const d of acc.days) {
    const notes = [...d.labels];
    if (d.summary?.deductedMinutes) notes.push(`Pausenabzug ${d.summary.deductedMinutes} Min.`);
    if (d.summary?.notCreditedMinutes) notes.push(`vor Anrechnung ${d.summary.notCreditedMinutes} Min.`);
    if (d.corrected) notes.push("korrigiert");
    const off = d.weekday === 0 || d.weekday === 6 || !!d.holiday;
    row(
      [
        `${WD[d.weekday]} ${d.date.slice(8, 10)}.${d.date.slice(5, 7)}.`,
        d.summary?.firstStart ? fmtTime(d.summary.firstStart) : "",
        d.summary?.lastEnd && !d.summary.open ? fmtTime(d.summary.lastEnd) : "",
        d.summary ? hm(d.summary.breakMinutes + d.summary.deductedMinutes) : "",
        d.targetMinutes ? hm(d.targetMinutes) : "",
        d.actualMinutes || d.summary ? hm(d.actualMinutes) : "",
        d.pending ? "" : d.diffMinutes ? sg(d.diffMinutes) : "",
        notes.join(", "),
      ],
      { fill: off ? "#eef4fd" : undefined },
    );
  }
  y += 8;

  // Summen
  const lines: [string, string][] = [
    ["Soll", `${hm(s.targetMinutes)} Std.`],
    ["Ist (gearbeitet + Gutschriften)", `${hm(s.actualMinutes)} Std. (davon gearbeitet ${hm(s.workedMinutes)})`],
    ["Mehr-/Minderstunden im Monat", `${sg(s.diffMinutes)} Std.`],
    ["Übertrag Vormonat", `${sg(s.openingBalance)} Std.`],
    ...(s.adjustmentMinutes ? ([["Buchungen Zeitkonto", `${sg(s.adjustmentMinutes)} Std.`]] as [string, string][]) : []),
    ["Saldo Zeitkonto Monatsende", `${sg(s.closingBalance)} Std.`],
    ["Urlaub / Krank / Feiertage", `${days(s.vacationDays)} / ${s.sickDays} / ${s.holidayDays} Tage`],
  ];
  if (y > 640) {
    doc.addPage();
    y = 40;
  }
  for (const [k, v] of lines) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000").text(k, 40, y, { width: 220 });
    doc.font("Helvetica").text(v, 260, y, { width: 295 });
    y += 14;
  }
  if (acc.adjustments.length) {
    y += 4;
    doc.font("Helvetica").fontSize(8).text(acc.adjustments.map((a) => `${a.date.split("-").reverse().join(".")}: ${sg(a.minutes)} Std. – ${a.reason}`).join("\n"), 40, y, { width: 515 });
    y = doc.y + 6;
  }

  // Unterschriften
  y = Math.max(y + 30, 700);
  if (y > 770) {
    doc.addPage();
    y = 80;
  }
  doc.moveTo(40, y).lineTo(250, y).strokeColor("#000000").stroke();
  doc.moveTo(320, y).lineTo(555, y).stroke();
  doc.font("Helvetica").fontSize(8).text(s.employeeConfirmedAt ? `Digital bestätigt am ${fmtDateTime(s.employeeConfirmedAt)}` : "Datum, Unterschrift Mitarbeiter/in", 40, y + 4);
  doc.text("Datum, Unterschrift Arbeitgeber", 320, y + 4);
  doc.fontSize(7).fillColor("#555555").text(`Erstellt ${fmtDateTime(new Date())} · Zeitnachweis nach § 16 Abs. 2 ArbZG – Aufbewahrung mindestens 2 Jahre`, 40, 788, { width: 515, align: "center", lineBreak: false });

  doc.end();
  return done;
}
