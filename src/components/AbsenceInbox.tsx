import type { InboxAbsence } from "@/modules/abwesenheit/inbox";
import { DecisionForm } from "./DecisionForm";

type Act = Parameters<typeof DecisionForm>[0]["action"];

export function AbsenceInbox({ items, action }: { items: InboxAbsence[]; action: Act }) {
  if (!items.length) return <p className="card">Keine offenen Urlaubs- oder Abwesenheitsanträge.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {items.map((r) => (
        <li key={r.id} className="card flex flex-col gap-2" data-testid="abwesenheitsantrag">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-lg">{r.name}</b>
            <span className="text-sm">{r.department}</span>
          </div>
          {r.storno && <p className="font-bold text-blau-700">Stornierung eines genehmigten Antrags{r.cancelReason ? `: „${r.cancelReason}“` : ""}</p>}
          <div><b>{r.type}</b>: {r.range} ({r.days.toLocaleString("de-DE")} Tage)</div>
          {r.comment && <div>„{r.comment}“</div>}
          {r.remainingAfter !== null && !r.storno && (
            <div className={r.remainingAfter < 0 ? "font-bold text-red-700" : ""}>Resturlaub danach: {r.remainingAfter.toLocaleString("de-DE")} Tage</div>
          )}
          {r.conflicts.length > 0 && (
            <div role="note" className="rounded-xl bg-gelb-100 p-3 ring-2 ring-gelb-500" data-testid="besetzungshinweis">
              <b>Hinweis Mindestbesetzung:</b>
              <ul className="text-sm">
                {r.conflicts.slice(0, 6).map((c) => (
                  <li key={c.date}>{c.date.split("-").reverse().join(".")}: nur {c.present} von mind. {c.min} anwesend{c.absent.length ? ` (abwesend: ${c.absent.join(", ")})` : ""}</li>
                ))}
                {r.conflicts.length > 6 && <li>… und {r.conflicts.length - 6} weitere Tage</li>}
              </ul>
            </div>
          )}
          <DecisionForm id={r.id} action={action} />
        </li>
      ))}
    </ul>
  );
}
