import { audit } from "@/lib/audit";
import { getSession } from "@/modules/auth/session";
import { personalDataExport } from "@/modules/admin/data-export";

export const dynamic = "force-dynamic";

/** Datenauskunft (Art. 15 DSGVO) – nur Admin */
export async function GET(req: Request) {
  const s = await getSession("ADMIN");
  if (!s || s.pending2fa || !s.employee.roles.includes("ADMIN") || s.employee.passwordMustChange) return new Response("Keine Berechtigung", { status: 403 });
  const id = new URL(req.url).searchParams.get("mitarbeiter");
  if (!id) return new Response("Mitarbeiter fehlt", { status: 400 });
  const data = await personalDataExport(id);
  await audit({ actorId: s.employeeId, subjectId: id, action: "export.data_access", entityType: "Export", entityId: id });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="Datenauskunft_${data.stammdaten.personnelNo}_${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
