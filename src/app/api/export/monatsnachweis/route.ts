import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSession } from "@/modules/auth/session";
import { monthReportPdf } from "@/modules/admin/pdf";

export const dynamic = "force-dynamic";

/** PDF-Monatsnachweis: Admin für alle, Mitarbeiter nur für sich selbst */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const m = /^(\d{4})-(\d{2})$/.exec(url.searchParams.get("monat") ?? "");
  if (!m) return new Response("Monat fehlt", { status: 400 });
  const admin = await getSession("ADMIN");
  const isAdmin = !!admin && !admin.pending2fa && admin.employee.roles.includes("ADMIN") && !admin.employee.passwordMustChange;
  let employeeId = url.searchParams.get("mitarbeiter");
  if (!isAdmin || !employeeId) {
    const s = await getSession("MITARBEITER");
    if (!s || s.employee.pinMustChange) return new Response("Bitte anmelden", { status: 401 });
    if (employeeId && employeeId !== s.employeeId) return new Response("Keine Berechtigung", { status: 403 });
    employeeId = s.employeeId;
  }
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return new Response("Nicht gefunden", { status: 404 });
  const pdf = await monthReportPdf(emp.id, Number(m[1]), Number(m[2]));
  if (isAdmin) await audit({ actorId: admin!.employeeId, subjectId: emp.id, action: "export.month_pdf", entityType: "Export", entityId: `${m[1]}-${m[2]}` });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Monatsnachweis_${m[1]}-${m[2]}_${emp.personnelNo}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
