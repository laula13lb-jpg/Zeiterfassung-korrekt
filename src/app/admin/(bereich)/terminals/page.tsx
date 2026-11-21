import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { setTerminalActive } from "@/modules/admin/terminal-admin";
import { TerminalCodeForm } from "./TerminalCodeForm";

export const metadata = { title: "Terminals" };

export default async function TerminalsPage() {
  await requireAdmin();
  const terminals = await db.terminalDevice.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Terminals</h1>
      <p>Ein Terminal ist ein fest installiertes Tablet in der Werkstatt. So schalten Sie es frei:</p>
      <ol className="list-decimal space-y-1 pl-6">
        <li>Hier einen Freischaltcode erzeugen (gilt 24 Stunden, nur einmal nutzbar).</li>
        <li>Auf dem Tablet die App öffnen und <b>/terminal</b> aufrufen (Startseite → „Werkstatt-Terminal“).</li>
        <li>Code eingeben – fertig. Das Tablet bleibt dauerhaft freigeschaltet.</li>
      </ol>
      <TerminalCodeForm />
      <section className="card">
        <h2 className="mb-3 text-xl font-bold">Vorhandene Terminals</h2>
        {terminals.length === 0 ? <p>Noch keine Terminals.</p> : (
          <ul className="divide-y divide-blau-100">
            {terminals.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-48 flex-1">
                  <div className="font-bold">{t.name}</div>
                  <div className="text-sm">
                    {!t.active ? "gesperrt" : t.tokenHash ? `aktiv · zuletzt gesehen ${t.lastSeenAt ? fmtDateTime(t.lastSeenAt) : "–"}` : "wartet auf Freischaltung"}
                  </div>
                </div>
                <TerminalCodeForm id={t.id} label="Neues Gerät koppeln" />
                <form action={setTerminalActive.bind(null, t.id, !t.active)}>
                  <button className="btn btn-ghost min-h-12 text-base">{t.active ? "Sperren" : "Entsperren"}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
