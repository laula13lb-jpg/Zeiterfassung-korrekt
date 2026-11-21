"use client";

import { useActionState } from "react";
import { saveSchedule, setTimeAccountStart } from "@/modules/admin/schedule-admin";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

const DAYS = [["mon", "Mo"], ["tue", "Di"], ["wed", "Mi"], ["thu", "Do"], ["fri", "Fr"], ["sat", "Sa"], ["sun", "So"]] as const;

export function ScheduleForm({ employeeId, defaults }: { employeeId: string; defaults: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveSchedule, undefined);
  return (
    <KeepForm action={action} className="flex flex-col gap-3 border-t border-blau-100 pt-3">
      <h3 className="font-bold">Neues Modell / Änderung ab Datum</h3>
      <input type="hidden" name="employeeId" value={employeeId} />
      <FormMessage state={state} />
      <label className="max-w-48"><span className="mb-1 block text-sm font-semibold">gültig ab</span>
        <input type="date" name="validFrom" required className="field min-h-12" /></label>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAYS.map(([k, l]) => (
          <label key={k}><span className="mb-1 block text-sm font-semibold">{l}</span>
            <input name={k} defaultValue={defaults[k]} inputMode="numeric" aria-label={`Stunden ${l}`} className="field min-h-12 px-2 text-center" /></label>
        ))}
      </div>
      <p className="text-sm">Stunden pro Tag als Std:Min (z. B. 8:00). 0:00 = arbeitsfrei.</p>
      <button disabled={pending} className="btn btn-primary self-start">Speichern</button>
    </KeepForm>
  );
}

export function AccountStartForm({ employeeId, value }: { employeeId: string; value: string }) {
  const [state, action, pending] = useActionState(setTimeAccountStart, undefined);
  return (
    <KeepForm action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <label><span className="mb-1 block text-sm font-semibold">Zeitkonto ab</span>
        <input type="date" name="timeAccountStart" defaultValue={value} className="field min-h-12" /></label>
      <button disabled={pending} className="btn btn-ghost min-h-12">Speichern</button>
      <div className="w-full"><FormMessage state={state} /></div>
    </KeepForm>
  );
}
