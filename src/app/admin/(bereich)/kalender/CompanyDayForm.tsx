"use client";

import { useActionState } from "react";
import { addCompanyDays } from "@/modules/admin/calendar-admin";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function CompanyDayForm() {
  const [state, action, pending] = useActionState(addCompanyDays, undefined);
  return (
    <KeepForm action={action} className="flex flex-col gap-3 border-t border-blau-100 pt-3">
      <h3 className="font-bold">Betriebstag(e) hinzufügen</h3>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block text-sm font-semibold">von</span><input type="date" name="from" required className="field min-h-12" /></label>
        <label><span className="mb-1 block text-sm font-semibold">bis (optional)</span><input type="date" name="to" className="field min-h-12" /></label>
        <label><span className="mb-1 block text-sm font-semibold">Art</span>
          <select name="kind" className="field min-h-12">
            <option value="HALBER_TAG">halber Tag (Soll halbiert)</option>
            <option value="BETRIEBSFERIEN">Betriebsferien</option>
            <option value="FREIER_TAG">freier Tag (Soll 0)</option>
          </select></label>
        <label><span className="mb-1 block text-sm font-semibold">Bezeichnung</span><input name="name" required className="field min-h-12" placeholder="z. B. Betriebsferien Weihnachten" /></label>
      </div>
      <label className="flex items-center gap-3"><input type="checkbox" name="countsAsVacation" defaultChecked className="h-6 w-6 accent-blau-800" />
        Betriebsferien als Urlaub verrechnen (vom Urlaubsanspruch abziehen)</label>
      <button disabled={pending} className="btn btn-primary self-start">Hinzufügen</button>
    </KeepForm>
  );
}
