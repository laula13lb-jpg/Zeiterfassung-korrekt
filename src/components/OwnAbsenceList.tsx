"use client";

import { useActionState } from "react";
import { cancelOwnAbsence } from "@/modules/abwesenheit/absence-actions";
import { FormMessage } from "./FormMessage";
import { KeepForm } from "./KeepForm";

export type OwnAbsence = { id: string; type: string; range: string; days: number; status: string; comment: string | null; decisionReason: string | null };

const STATUS: Record<string, { t: string; c: string }> = {
  BEANTRAGT: { t: "beantragt", c: "bg-gelb-500 text-blau-950" },
  GENEHMIGT: { t: "genehmigt", c: "bg-green-700 text-white" },
  ABGELEHNT: { t: "abgelehnt", c: "bg-red-700 text-white" },
  STORNO_BEANTRAGT: { t: "Stornierung beantragt", c: "bg-blau-600 text-white" },
  STORNIERT: { t: "storniert", c: "bg-blau-100 text-blau-900" },
};

function Item({ a }: { a: OwnAbsence }) {
  const [state, action, pending] = useActionState(cancelOwnAbsence, undefined);
  return (
    <li className="flex flex-col gap-2 py-3" data-testid="mein-antrag">
      <div className="flex flex-wrap items-center gap-2">
        <b>{a.type}</b><span>{a.range}</span><span className="text-sm">({a.days.toLocaleString("de-DE")} Tage)</span>
        <span className={`ml-auto rounded-full px-3 py-0.5 text-sm font-bold ${STATUS[a.status]?.c}`}>{STATUS[a.status]?.t ?? a.status}</span>
      </div>
      {a.decisionReason && <div className="text-sm">Begründung: {a.decisionReason}</div>}
      <FormMessage state={state} />
      {!state?.ok && (a.status === "BEANTRAGT" || a.status === "GENEHMIGT") && (
        <KeepForm action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="id" value={a.id} />
          {a.status === "GENEHMIGT" && <input name="reason" placeholder="Grund (optional)" aria-label="Grund für Stornierung" className="field min-h-11 flex-1" />}
          <button disabled={pending} className="btn btn-ghost min-h-11 px-4 text-base">{a.status === "BEANTRAGT" ? "Zurückziehen" : "Stornierung beantragen"}</button>
        </KeepForm>
      )}
    </li>
  );
}

export function OwnAbsenceList({ items }: { items: OwnAbsence[] }) {
  if (!items.length) return <p>Noch keine Anträge.</p>;
  return <ul className="divide-y divide-blau-100">{items.map((a) => <Item key={a.id} a={a} />)}</ul>;
}
