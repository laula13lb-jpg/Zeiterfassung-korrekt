import ExcelJS from "exceljs";
import { audit } from "@/lib/audit";
import { getSession } from "@/modules/auth/session";
import { PAYROLL_COLUMNS, payrollRows, toCsv } from "@/modules/admin/month-report";

export const dynamic = "force-dynamic";

/** Gesamtübersicht für die Lohnabrechnung (CSV oder Excel) – nur Admin */
export async function GET(req: Request) {
  const s = await getSession("ADMIN");
  if (!s || s.pending2fa || !s.employee.roles.includes("ADMIN") || s.employee.passwordMustChange) return new Response("Keine Berechtigung", { status: 403 });
  const url = new URL(req.url);
  const m = /^(\d{4})-(\d{2})$/.exec(url.searchParams.get("monat") ?? "");
  if (!m) return new Response("Monat fehlt", { status: 400 });
  const rows = await payrollRows(Number(m[1]), Number(m[2]));
  await audit({ actorId: s.employeeId, action: "export.payroll", entityType: "Export", entityId: `${m[1]}-${m[2]}` });
  const name = `Lohnliste_${m[1]}-${m[2]}`;
  if (url.searchParams.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Zeiterfassung Autoklinik Bludau";
    const ws = wb.addWorksheet(`${m[1]}-${m[2]}`);
    ws.columns = PAYROLL_COLUMNS.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 2), style: c.unit === "std" ? { numFmt: "0.00" } : c.unit === "tage" ? { numFmt: "0.0" } : {} }));
    for (const r of rows) ws.addRow(Object.fromEntries(PAYROLL_COLUMNS.map((c) => [c.key, c.value(r)])));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"`, "cache-control": "no-store" },
    });
  }
  return new Response(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"`, "cache-control": "no-store" },
  });
}
