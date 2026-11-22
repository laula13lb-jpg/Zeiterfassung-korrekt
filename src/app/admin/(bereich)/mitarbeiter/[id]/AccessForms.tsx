"use client";

import { useActionState } from "react";
import { resetAdminPassword, resetPin, setEmployeeStatus } from "@/modules/admin/employee-admin";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";
import { SecretBox } from "@/components/EmployeeForm";

export function AccessForms({ id, status, isAdmin, exitDate, locked }: { id: string; status: string; isAdmin: boolean; exitDate: string | null; locked: boolean }) {
  const [pinState, pinAction, pinPending] = useActionState(resetPin, undefined);
  const [pwState, pwAction, pwPending] = useActionState(resetAdminPassword, undefined);
  const [stState, stAction, stPending] = useActionState(setEmployeeStatus, undefined);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FormMessage state={pinState} />
        <SecretBox pin={pinState?.pin} />
        <KeepForm action={pinAction}><input type="hidden" name="id" value={id} />
          <button disabled={pinPending} className="btn btn-ghost">PIN zurücksetzen (neue Start-PIN)</button></KeepForm>
      </div>
      {isAdmin && (
        <div className="flex flex-col gap-2">
          <FormMessage state={pwState} />
          <SecretBox password={pwState?.password} />
          <KeepForm action={pwAction} className="flex flex-wrap items-center gap-3"><input type="hidden" name="id" value={id} />
            <button disabled={pwPending} className="btn btn-ghost">Admin-Passwort zurücksetzen</button>
            <label className="flex items-center gap-2"><input type="checkbox" name="reset2fa" className="h-5 w-5" />auch 2FA zurücksetzen (Handy verloren)</label>
          </KeepForm>
        </div>
      )}
      <FormMessage state={stState} />
      {(status !== "AKTIV" || locked) && (
        <KeepForm action={stAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="unlock" />
          <button disabled={stPending} className="btn btn-primary">{status === "AUSGETRETEN" ? "Wieder aktivieren" : "Entsperren"}</button></KeepForm>
      )}
      {status === "AKTIV" && (
        <KeepForm action={stAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="lock" />
          <button disabled={stPending} className="btn min-h-12 bg-red-700 text-white">Zugang sperren</button>
          <span className="text-sm">Sofort: keine Anmeldung, kein Stempeln (z. B. Handy verloren).</span></KeepForm>
      )}
      {status !== "AUSGETRETEN" && (
        <KeepForm action={stAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="id" value={id} /><input type="hidden" name="op" value="exit" />
          <label><span className="mb-1 block text-sm font-semibold">Austritt zum</span>
            <input type="date" name="exitDate" defaultValue={exitDate ?? ""} required className="field min-h-12" /></label>
          <button disabled={stPending} className="btn btn-ghost min-h-12">Austritt eintragen</button>
          <span className="w-full text-sm">Daten bleiben für die Aufbewahrungsfristen erhalten. Urlaub wird anteilig berechnet.</span></KeepForm>
      )}
    </div>
  );
}
