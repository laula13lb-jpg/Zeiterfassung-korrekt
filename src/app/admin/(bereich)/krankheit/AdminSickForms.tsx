"use client";

import { useActionState, useState } from "react";
import { adminCancelSick, adminSaveSick, confirmVacationRefund } from "@/modules/abwesenheit/sick-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

type Sick = { id: string; start: string; end: string; auPresent: boolean; eauRetrieved: boolean; childSick: boolean };

export function AdminSickForm({ sick, employees, today }: { sick?: Sick; employees?: { id: string; name: string }[]; today?: string }) {
  const [state, action, pending] = useActionState(adminSaveSick, undefined);
  return (
    <KeepForm action={action} className={sick ? "flex flex-wrap items-end gap-3" : "card flex flex-col gap-3"}>
      {sick && <input type="hidden" name="id" value={sick.id} />}
      {employees && (
        <label><span className="mb-1 block font-semibold">Mitarbeiter</span>
          <select name="employeeId" required className="field"><option value="">– bitte wählen –</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      )}
      <div className="flex flex-wrap gap-3">
        <label><span className="mb-1 block text-sm font-semibold">von</span>
          <input type="date" name="start" defaultValue={sick?.start ?? today} required aria-label="krank von" className="field min-h-12" /></label>
        <label><span className="mb-1 block text-sm font-semibold">bis (voraussichtlich)</span>
          <input type="date" name="end" defaultValue={sick?.end ?? today} required aria-label="krank bis" className="field min-h-12" /></label>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 pb-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="auPresent" defaultChecked={sick?.auPresent} className="h-5 w-5" />AU liegt vor</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="eauRetrieved" defaultChecked={sick?.eauRetrieved} className="h-5 w-5" />eAU abgerufen</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="childSick" defaultChecked={sick?.childSick} className="h-5 w-5" />Kind krank</label>
      </div>
      <button disabled={pending} className={sick ? "btn btn-ghost min-h-12" : "btn btn-primary self-start"}>{sick ? "Speichern" : "Erfassen"}</button>
      <div className="w-full"><FormMessage state={state} /></div>
    </KeepForm>
  );
}

export function CancelSickForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adminCancelSick, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-semibold text-red-800 underline">stornieren (z. B. versehentlich erfasst)</button>;
  return (
    <KeepForm action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" required placeholder="Begründung" aria-label="Begründung Stornierung" className="field min-h-10 w-64" />
      <button disabled={pending} className="btn min-h-10 bg-red-700 px-3 text-sm text-white">Stornieren</button>
      <FormMessage state={state} />
    </KeepForm>
  );
}

export function RefundForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(confirmVacationRefund, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <KeepForm action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn btn-primary min-h-10 px-3 text-sm">Urlaubstage zurückbuchen</button>
      <FormMessage state={state} />
    </KeepForm>
  );
}
