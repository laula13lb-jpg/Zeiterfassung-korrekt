"use client";

import { useActionState } from "react";
import { changeAdminPassword } from "@/modules/auth/actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeAdminPassword, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      <label><span className="mb-1 block font-semibold">Bisheriges Passwort</span>
        <input name="currentPassword" type="password" autoComplete="current-password" required className="field" /></label>
      <label><span className="mb-1 block font-semibold">Neues Passwort</span>
        <input name="newPassword" type="password" autoComplete="new-password" minLength={12} required className="field" /></label>
      <label><span className="mb-1 block font-semibold">Neues Passwort wiederholen</span>
        <input name="repeatPassword" type="password" autoComplete="new-password" minLength={12} required className="field" /></label>
      <button type="submit" disabled={pending} className="btn btn-primary">Passwort speichern</button>
    </KeepForm>
  );
}
