"use client";

import { useActionState } from "react";
import { confirmMonth } from "@/modules/admin/closing-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function ConfirmMonth({ monat }: { monat: string }) {
  const [state, action, pending] = useActionState(confirmMonth, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <KeepForm action={action} className="card flex flex-col gap-2 border-l-8 border-gelb-500">
      <input type="hidden" name="monat" value={monat} />
      <p className="font-semibold">Bitte prüfe deinen Monatsnachweis. Stimmt alles?</p>
      <FormMessage state={state} />
      <button disabled={pending} className="btn btn-accent self-start">Ja, Monatsnachweis bestätigen</button>
      <p className="text-sm">Wenn etwas nicht stimmt: bitte im Büro melden.</p>
    </KeepForm>
  );
}
