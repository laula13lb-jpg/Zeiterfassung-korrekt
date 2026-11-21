"use client";

import { useActionState } from "react";
import { FormMessage } from "./FormMessage";
import { KeepForm } from "./KeepForm";

type Act = (prev: { error?: string; ok?: string } | undefined, fd: FormData) => Promise<{ error?: string; ok?: string } | undefined>;

/** Genehmigen/Ablehnen mit optionaler (bei Ablehnung Pflicht-)Begründung */
export function DecisionForm({ id, action }: { id: string; action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <KeepForm action={act} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <input name="reason" placeholder="Begründung (bei Ablehnung Pflicht)" aria-label="Begründung" className="field min-h-12" />
      <div className="grid grid-cols-2 gap-2">
        <button name="decision" value="approve" disabled={pending} className="btn min-h-12 bg-green-700 text-white hover:bg-green-600">Genehmigen</button>
        <button name="decision" value="reject" disabled={pending} className="btn min-h-12 bg-red-700 text-white hover:bg-red-600">Ablehnen</button>
      </div>
    </KeepForm>
  );
}
