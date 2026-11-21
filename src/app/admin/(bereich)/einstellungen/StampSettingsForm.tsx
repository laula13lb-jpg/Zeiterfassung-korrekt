"use client";

import { useActionState } from "react";
import { saveStampSettings } from "@/modules/admin/settings-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function StampSettingsForm({ personal, ranges, mode }: { personal: boolean; ranges: string; mode: "hinweis" | "abzug" }) {
  const [state, action, pending] = useActionState(saveStampSettings, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-5">
      <h2 className="text-xl font-bold">Stempeln</h2>
      <FormMessage state={state} />
      <label className="flex items-start gap-3 text-lg">
        <input type="checkbox" name="stampFromPersonalDevices" defaultChecked={personal} className="mt-1 h-7 w-7 accent-blau-800" />
        <span><b>Stempeln auch vom Handy/PC erlauben</b><br /><span className="text-base">Aus: nur am freigeschalteten Werkstatt-Terminal. GPS wird nie verwendet.</span></span>
      </label>
      <label>
        <span className="mb-1 block font-semibold">Nur aus diesen Netzen (optional, eine Adresse pro Zeile)</span>
        <textarea name="ranges" defaultValue={ranges} rows={3} placeholder="z. B. 84.123.45.67 (öffentliche IP der Werkstatt)" className="field py-3" />
        <span className="text-sm">Leer = von überall. Tipp: Die öffentliche IP-Adresse Ihres Werkstatt-Internetanschlusses eintragen, dann geht Stempeln am Handy nur im Firmen-WLAN.</span>
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Fehlende Pause (§4 Arbeitszeitgesetz)</legend>
        <label className="flex items-start gap-3"><input type="radio" name="missingBreakMode" value="hinweis" defaultChecked={mode === "hinweis"} className="mt-1 h-6 w-6 accent-blau-800" />
          <span><b>Nur Hinweis</b> – Zeit bleibt unverändert, der Tag wird für die Verwaltung markiert</span></label>
        <label className="flex items-start gap-3"><input type="radio" name="missingBreakMode" value="abzug" defaultChecked={mode === "abzug"} className="mt-1 h-6 w-6 accent-blau-800" />
          <span><b>Automatisch abziehen</b> – fehlende Pausenzeit wird abgezogen und gekennzeichnet</span></label>
      </fieldset>
      <button disabled={pending} className="btn btn-primary">Speichern</button>
    </KeepForm>
  );
}
