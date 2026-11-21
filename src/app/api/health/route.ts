import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Health-Check für Überwachung (Uptime-Dienst) und Docker – keine personenbezogenen Daten */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", time: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "error", db: "nicht erreichbar" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
