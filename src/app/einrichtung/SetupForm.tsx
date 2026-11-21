"use client";

import { useActionState } from "react";
import { createFirstAdmin } from "@/modules/auth/setup";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function SetupForm() {
  const [state, action, pending] = useActionState(createFirstAdmin, undefined);
  const f = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label><span className="mb-1 block font-semibold">{label}</span><input name={name} required className="field" {...props} /></label>
  );
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      {f("token", "Einrichtungscode", { autoComplete: "off" })}
      <div className="grid gap-4 sm:grid-cols-2">{f("firstName", "Vorname")}{f("lastName", "Nachname")}</div>
      {f("loginName", "Benutzername (z. B. buero)", { autoCapitalize: "none", autoComplete: "username" })}
      {f("password", "Passwort (mind. 12 Zeichen)", { type: "password", minLength: 12, autoComplete: "new-password" })}
      {f("repeatPassword", "Passwort wiederholen", { type: "password", minLength: 12, autoComplete: "new-password" })}
      <button disabled={pending} className="btn btn-accent">Admin anlegen</button>
    </KeepForm>
  );
}
