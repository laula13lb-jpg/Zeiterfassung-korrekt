"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createEmployee, updateEmployee } from "@/modules/admin/employee-admin";
import { FormMessage } from "./FormMessage";
import { KeepForm } from "./KeepForm";

type Dept = { id: string; name: string };
export type EmpValues = {
  id?: string; personnelNo: string; firstName: string; lastName: string; email: string; departmentId: string;
  entryDate: string; tracksTime: boolean; lead: boolean; admin: boolean; leadOf: string[]; loginName: string;
};

/** Zugangsdaten nur einmal anzeigen */
export function SecretBox({ pin, password }: { pin?: string; password?: string }) {
  if (!pin && !password) return null;
  return (
    <div role="status" className="rounded-xl bg-gelb-100 p-4 ring-2 ring-gelb-500" data-testid="zugangsdaten">
      <p className="font-bold">Bitte jetzt notieren und persönlich übergeben – wird nicht erneut angezeigt:</p>
      {pin && <p>Start-PIN: <span className="font-mono text-2xl font-black tracking-widest" data-testid="start-pin">{pin}</span></p>}
      {password && <p>Start-Passwort (Admin): <span className="font-mono text-lg font-black" data-testid="start-passwort">{password}</span></p>}
      <p className="text-sm">Beim ersten Anmelden muss eine eigene PIN bzw. ein eigenes Passwort vergeben werden.</p>
    </div>
  );
}

export function EmployeeForm({ depts, initial }: { depts: Dept[]; initial?: EmpValues }) {
  const create = !initial?.id;
  const [state, action, pending] = useActionState(create ? createEmployee : updateEmployee, undefined);
  const [v, setV] = useState({ lead: initial?.lead ?? false, admin: initial?.admin ?? false });
  if (create && state?.ok && state.id) {
    return (
      <div className="card flex flex-col gap-3">
        <FormMessage state={state} />
        <SecretBox pin={state.pin} password={state.password} />
        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/mitarbeiter/${state.id}`} className="btn btn-primary">Weiter zu Details (Arbeitszeit, Urlaub)</Link>
          <Link href="/admin/mitarbeiter" className="btn btn-ghost">Zur Liste</Link>
        </div>
      </div>
    );
  }
  const f = (name: keyof EmpValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label><span className="mb-1 block font-semibold">{label}</span>
      <input name={name} defaultValue={(initial?.[name] as string) ?? ""} className="field" {...props} /></label>
  );
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormMessage state={state} />
      <SecretBox pin={state?.pin} password={state?.password} />
      <div className="grid gap-3 sm:grid-cols-3">
        {f("personnelNo", "Personalnummer", { required: true })}
        {f("firstName", "Vorname", { required: true })}
        {f("lastName", "Nachname", { required: true })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="mb-1 block font-semibold">Abteilung</span>
          <select name="departmentId" defaultValue={initial?.departmentId ?? ""} className="field">
            <option value="">– keine –</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        {f("entryDate", "Eintritt", { type: "date", required: true })}
        {f("email", "E-Mail (optional)", { type: "email" })}
      </div>
      {create && (
        <label><span className="mb-1 block font-semibold">Wochenstunden</span>
          <input name="weeklyHours" defaultValue="39" inputMode="decimal" className="field max-w-32" />
          <span className="text-sm">Verteilung Mo–Do gleich, Freitag kürzer – danach unter „Details“ genau anpassbar.</span></label>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Rollen</legend>
        <label className="flex items-center gap-3"><input type="checkbox" name="tracksTime" defaultChecked={initial?.tracksTime ?? true} className="h-6 w-6 accent-blau-800" />Zeiterfassung (stempelt, hat Zeitkonto und Urlaub)</label>
        <label className="flex items-center gap-3"><input type="checkbox" name="roleLead" checked={v.lead} onChange={(e) => setV({ ...v, lead: e.target.checked })} className="h-6 w-6 accent-blau-800" />Abteilungsleiter</label>
        {v.lead && (
          <div className="ml-9 flex flex-wrap gap-4">
            {depts.map((d) => (
              <label key={d.id} className="flex items-center gap-2"><input type="checkbox" name="leadOf" value={d.id} defaultChecked={initial?.leadOf.includes(d.id)} className="h-5 w-5" />leitet {d.name}</label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-3"><input type="checkbox" name="roleAdmin" checked={v.admin} onChange={(e) => setV({ ...v, admin: e.target.checked })} className="h-6 w-6 accent-blau-800" />Admin (Verwaltung)</label>
        {v.admin && <div className="ml-9 max-w-sm">{f("loginName", "Benutzername für Admin-Anmeldung", { autoCapitalize: "none" })}</div>}
      </fieldset>
      <button disabled={pending} className="btn btn-primary self-start">{create ? "Mitarbeiter anlegen" : "Stammdaten speichern"}</button>
    </KeepForm>
  );
}
