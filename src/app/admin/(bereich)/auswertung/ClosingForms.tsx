"use client";

import { useActionState, useState } from "react";
import { closeMonth, reopenMonth } from "@/modules/admin/closing-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function CloseMonthForm({ ids, monat, label, small }: { ids: string[]; monat: string; label: string; small?: boolean }) {
  const [state, action, pending] = useActionState(closeMonth, undefined);
  return (
    <KeepForm action={action} className={small ? "mt-1" : "flex flex-col gap-2"}>
      <input type="hidden" name="monat" value={monat} />
      {ids.map((id) => <input key={id} type="hidden" name="employeeId" value={id} />)}
      <FormMessage state={state} />
      <button disabled={pending} className={small ? "text-sm font-semibold text-green-800 underline" : "btn btn-primary self-start"}>{label}</button>
    </KeepForm>
  );
}

export function ReopenMonthForm({ employeeId, monat }: { employeeId: string; monat: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reopenMonth, undefined);
  if (!open) return <div><button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold underline">wieder öffnen</button></div>;
  return (
    <KeepForm action={action} className="mt-1 flex flex-col gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="monat" value={monat} />
      <input name="reason" required placeholder="Begründung" aria-label="Begründung Wiedereröffnung" className="field min-h-10 text-sm" />
      <button disabled={pending} className="btn min-h-10 bg-red-700 px-3 text-sm text-white">Öffnen</button>
      <FormMessage state={state} />
    </KeepForm>
  );
}
