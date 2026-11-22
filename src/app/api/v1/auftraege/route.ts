/** [AUFTRAEGE] Platzhalter der künftigen Schnittstelle (Carisma-Import, Kunden-App). */
export const dynamic = "force-dynamic";

const body = { status: "geplant", modul: "Arbeitsaufträge", hinweis: "Noch nicht verfügbar – siehe docs/modul-auftraege.md" };

export async function GET() {
  return Response.json(body, { status: 501 });
}
export async function POST() {
  return Response.json(body, { status: 501 });
}
