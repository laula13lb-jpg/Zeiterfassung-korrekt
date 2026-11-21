"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/modules/auth/actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      <label>
        <span className="mb-1 block font-semibold">Benutzername</span>
        <input name="loginName" autoComplete="username" autoCapitalize="none" required className="field" />
      </label>
      <label>
        <span className="mb-1 block font-semibold">Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Prüfe…" : "Anmelden"}</button>
    </KeepForm>
  );
}
