"use client";

import { useActionState } from "react";
import { addBalanceAdjustment } from "@/modules/zeiterfassung/correction-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function AdjustmentForm({ employeeId }: { employeeId: string }) {
  const [state, action, pending] = useActionState(addBalanceAdjustment, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-3">
      <h3 className="text-xl font-bold">Zeitkonto buchen</h3>
      <p className="text-sm">Für Saldo-Korrekturen, Übertrag bei Einführung, Auszahlung von Überstunden oder Freizeitausgleich in Stunden. (Ganze freie Tage als Freizeitausgleich bitte später als Abwesenheit eintragen.)</p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="mb-1 block font-semibold">Art</span>
          <select name="kind" className="field">
            <option value="KORREKTUR">Korrektur (+/−)</option>
            <option value="UEBERTRAG">Übertrag (Startsaldo)</option>
            <option value="FREIZEITAUSGLEICH">Freizeitausgleich (−)</option>
            <option value="AUSZAHLUNG">Auszahlung (−)</option>
          </select></label>
        <label><span className="mb-1 block font-semibold">Stunden</span>
          <input name="amount" placeholder="z. B. 2:30 oder -1:15" required className="field" /></label>
        <label><span className="mb-1 block font-semibold">Datum</span>
          <input name="datum" type="date" className="field" /></label>
      </div>
      <label><span className="mb-1 block font-semibold">Begründung (Pflicht)</span>
        <input name="reason" required className="field" /></label>
      <button disabled={pending} className="btn btn-primary">Buchen</button>
    </KeepForm>
  );
}
