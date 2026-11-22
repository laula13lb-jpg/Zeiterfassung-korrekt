"use client";

import { useActionState } from "react";
import { saveEntitlement } from "@/modules/abwesenheit/absence-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function EntitlementForm({ employeeId, year, days, carry, note, computed }: {
  employeeId: string; year: number; days: number; carry: number | null; note: string | null; computed: number;
}) {
  const [state, action, pending] = useActionState(saveEntitlement, undefined);
  const de = (x: number) => String(x).replace(".", ",");
  return (
    <KeepForm action={action} className="flex flex-col gap-2 rounded-xl bg-blau-50 p-3" >
      <h3 className="font-bold">{year}</h3>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="year" value={year} />
      <FormMessage state={state} />
      <div className="grid gap-2 sm:grid-cols-3">
        <label><span className="mb-1 block text-sm font-semibold">Urlaubstage {year}</span>
          <input name="days" defaultValue={de(days)} inputMode="decimal" aria-label={`Urlaubstage ${year}`} className="field min-h-12" /></label>
        <label><span className="mb-1 block text-sm font-semibold">Übertrag aus {year - 1} (Übernahme)</span>
          <input name="carryOverOverride" defaultValue={carry === null ? "" : de(carry)} inputMode="decimal" placeholder="automatisch" aria-label={`Übertrag ${year}`} className="field min-h-12" /></label>
        <label><span className="mb-1 block text-sm font-semibold">Notiz</span>
          <input name="note" defaultValue={note ?? ""} className="field min-h-12" /></label>
      </div>
      <p className="text-xs">Berechneter Standard: {de(computed)} Tage (anteilig nach Arbeitstagen/Woche und Ein-/Austritt). Übertrag leer lassen = automatisch aus dem Vorjahr.</p>
      <button disabled={pending} className="btn btn-primary min-h-12 self-start">Speichern</button>
    </KeepForm>
  );
}
