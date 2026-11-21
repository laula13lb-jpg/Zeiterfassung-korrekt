"use client";

import { useActionState } from "react";
import { confirmTotpSetup, disableTotp } from "@/modules/auth/actions";
import { FormMessage } from "@/components/FormMessage";

export function ConfirmTotpForm() {
  const [state, action, pending] = useActionState(confirmTotpSetup, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input name="code" inputMode="numeric" autoComplete="one-time-code" required aria-label="Code aus der App"
        className="field text-center text-2xl tracking-[0.4em]" />
      <button disabled={pending} className="btn btn-accent">Bestätigen und aktivieren</button>
    </form>
  );
}

export function DisableTotpForm() {
  const [state, action, pending] = useActionState(disableTotp, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <label><span className="mb-1 block text-sm font-semibold">Zum Abschalten Passwort eingeben</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" /></label>
      <button disabled={pending} className="btn btn-ghost">2FA abschalten</button>
    </form>
  );
}
