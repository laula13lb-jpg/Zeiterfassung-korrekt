"use client";

import { useActionState } from "react";
import { verifyAdminTotp } from "@/modules/auth/actions";
import { FormMessage } from "@/components/FormMessage";

export function TotpForm() {
  const [state, action, pending] = useActionState(verifyAdminTotp, undefined);
  return (
    <form action={action} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required autoFocus
        aria-label="Bestätigungscode" className="field text-center text-3xl tracking-[0.4em]" />
      <button type="submit" disabled={pending} className="btn btn-primary">Bestätigen</button>
    </form>
  );
}
