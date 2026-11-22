"use client";

import { useActionState } from "react";
import { extendSick, reportSick } from "@/modules/abwesenheit/sick-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function SickReportForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(reportSick, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <h2 className="text-xl font-bold">Krank melden</h2>
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <label><span className="mb-1 block font-semibold">krank seit</span>
          <input type="date" name="start" defaultValue={today} required className="field" /></label>
        <label><span className="mb-1 block font-semibold">voraussichtlich bis</span>
          <input type="date" name="end" defaultValue={today} required className="field" /></label>
      </div>
      <label className="flex items-center gap-3"><input type="checkbox" name="childSick" className="h-6 w-6 accent-blau-800" />Kind krank (Betreuung eines kranken Kindes)</label>
      <label className="flex items-center gap-3"><input type="checkbox" name="auPresent" className="h-6 w-6 accent-blau-800" />Ich war beim Arzt, eine AU wurde ausgestellt</label>
      <button disabled={pending} className="btn btn-accent">Krankmeldung absenden</button>
    </KeepForm>
  );
}

export function SickExtendForm({ id, end }: { id: string; end: string }) {
  const [state, action, pending] = useActionState(extendSick, undefined);
  return (
    <KeepForm action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label><span className="mb-1 block text-sm font-semibold">verlängern bis</span>
        <input type="date" name="end" min={end} required aria-label="Krankmeldung verlängern bis" className="field min-h-12" /></label>
      <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="auPresent" className="h-5 w-5" />neue AU ausgestellt</label>
      <button disabled={pending} className="btn btn-ghost min-h-12">Verlängern</button>
      <div className="w-full"><FormMessage state={state} /></div>
    </KeepForm>
  );
}
