import { fmtTime } from "@/lib/time";
import type { PresenceRow, PresenceState } from "@/modules/zeiterfassung/presence";

const STYLE: Record<PresenceState, { t: string; c: string }> = {
  DA: { t: "da", c: "bg-green-600 text-white" },
  PAUSE: { t: "Pause", c: "bg-gelb-500 text-blau-950" },
  GEGANGEN: { t: "gegangen", c: "bg-blau-100 text-blau-900" },
  ABWESEND: { t: "abwesend", c: "bg-blau-600 text-white" },
  FEHLT: { t: "fehlt", c: "bg-red-700 text-white" },
  FREI: { t: "frei", c: "bg-white text-blau-900 ring-1 ring-blau-200" },
};

export function PresenceBoard({ rows }: { rows: PresenceRow[] }) {
  const groups = new Map<string, PresenceRow[]>();
  for (const r of rows) (groups.get(r.department) ?? groups.set(r.department, []).get(r.department)!).push(r);
  const count = (s: PresenceState[]) => rows.filter((r) => s.includes(r.state)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Anwesend", ["DA", "PAUSE"]], ["Abwesend", ["ABWESEND"]], ["Fehlt", ["FEHLT"]], ["Gegangen/frei", ["GEGANGEN", "FREI"]]] as const).map(([l, s]) => (
          <div key={l} className="card"><div className="text-sm font-semibold uppercase text-blau-800">{l}</div><div className="text-4xl font-black">{count([...s])}</div></div>
        ))}
      </div>
      {[...groups.entries()].map(([dept, list]) => (
        <section key={dept} className="card">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wide text-blau-800">{dept}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-blau-50 px-3 py-2" data-testid="anwesenheit">
                <span className="font-semibold">{r.name}</span>
                <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${STYLE[r.state].c}`}>
                  {r.state === "ABWESEND" && r.reason ? r.reason : STYLE[r.state].t}{r.since ? ` seit ${fmtTime(r.since)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm">„fehlt“ = heute Arbeitstag laut Arbeitszeitmodell, aber weder gestempelt noch abwesend gemeldet. Aktualisiert sich alle 30 Sekunden.</p>
    </div>
  );
}
