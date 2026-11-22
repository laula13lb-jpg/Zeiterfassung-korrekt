"use client";

import { useActionState, useState } from "react";
import { adminCancelAbsence } from "@/modules/abwesenheit/absence-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function AdminCancelAbsence({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(adminCancelAbsence, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-red-800 underline">stornieren</button>;
  return (
    <KeepForm action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="reason" required placeholder="Begründung" aria-label="Begründung Stornierung" className="field min-h-10 w-56" />
      <button disabled={pending} className="btn min-h-10 bg-red-700 px-3 text-sm text-white">Stornieren</button>
      <FormMessage state={state} />
    </KeepForm>
  );
}
