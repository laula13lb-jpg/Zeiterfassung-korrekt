"use client";

import { useActionState } from "react";
import { changePin } from "@/modules/auth/actions";
import { FormMessage } from "@/components/FormMessage";

export function ChangePinForm() {
  const [state, action, pending] = useActionState(changePin, undefined);
  const pinField = { type: "password", inputMode: "numeric" as const, pattern: "[0-9]{4,6}", maxLength: 6, required: true, className: "field text-center text-2xl tracking-[0.5em]" };
  return (
    <form action={action} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      <label>
        <span className="mb-1 block font-semibold">Bisherige PIN</span>
        <input name="currentPin" autoComplete="current-password" {...pinField} />
      </label>
      <label>
        <span className="mb-1 block font-semibold">Neue PIN</span>
        <input name="newPin" autoComplete="new-password" {...pinField} />
      </label>
      <label>
        <span className="mb-1 block font-semibold">Neue PIN wiederholen</span>
        <input name="repeatPin" autoComplete="new-password" {...pinField} />
      </label>
      <button type="submit" disabled={pending} className="btn btn-accent">{pending ? "Speichere…" : "PIN speichern"}</button>
    </form>
  );
}
