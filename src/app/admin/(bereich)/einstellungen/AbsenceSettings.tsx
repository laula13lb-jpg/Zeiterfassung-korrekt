"use client";

import { useActionState } from "react";
import { saveAbsenceType, saveMinStaffing, saveVacationSettings } from "@/modules/admin/absence-settings";
import type { Settings } from "@/modules/admin/settings";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function VacationSettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState(saveVacationSettings, undefined);
  const [mm, dd] = s.carryOverExpiry.split("-");
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <h2 className="text-xl font-bold">Urlaub</h2>
      <FormMessage state={state} />
      <label><span className="mb-1 block font-semibold">Standard-Urlaubsanspruch (Tage/Jahr bei 5-Tage-Woche)</span>
        <input name="defaultVacationDays" defaultValue={String(s.defaultVacationDays).replace(".", ",")} inputMode="decimal" className="field max-w-32" />
        <span className="text-sm">Wird bei weniger Arbeitstagen pro Woche und bei Ein-/Austritt automatisch anteilig berechnet. Pro Person unter „Mitarbeiter“ änderbar.</span></label>
      <label className="flex items-center gap-3"><input type="checkbox" name="vacationExpiry" defaultChecked={s.vacationExpiry} className="h-6 w-6 accent-blau-800" />
        Resturlaub aus dem Vorjahr verfällt zum Stichtag</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="mb-1 block font-semibold">Stichtag (TT.MM.)</span>
          <input name="carryOverExpiry" defaultValue={`${dd}.${mm}.`} className="field" /></label>
        <label><span className="mb-1 block font-semibold">Hinweis an Mitarbeiter (Tage vorher)</span>
          <input name="carryOverWarnDays" defaultValue={s.carryOverWarnDays} inputMode="numeric" className="field" /></label>
      </div>
      <p className="text-sm">Rechtlicher Hinweis: Urlaub verfällt nur, wenn der Arbeitgeber rechtzeitig und konkret darauf hingewiesen hat. Die App zeigt den Hinweis automatisch an; bitte zusätzlich z. B. schriftlich informieren.</p>
      <label className="flex items-center gap-3"><input type="checkbox" name="hideAbsenceReasonForColleagues" defaultChecked={s.hideAbsenceReasonForColleagues} className="h-6 w-6 accent-blau-800" />
        Kollegen sehen nur „abwesend“ (ohne Grund)</label>
      <button disabled={pending} className="btn btn-primary self-start">Speichern</button>
    </KeepForm>
  );
}

type T = { id: string; name: string; color: string; creditsTarget: boolean; requiresApproval: boolean; active: boolean; system: boolean; deductsVacation: boolean };

function TypeRow({ t }: { t?: T }) {
  const [state, action, pending] = useActionState(saveAbsenceType, undefined);
  return (
    <KeepForm action={action} className="flex flex-wrap items-center gap-3 border-t border-blau-100 py-3">
      {t && <input type="hidden" name="id" value={t.id} />}
      <input name="name" defaultValue={t?.name ?? ""} placeholder="Neue Art, z. B. Schulung" aria-label="Name der Abwesenheitsart" className="field min-h-11 w-56" />
      <input type="color" name="color" defaultValue={t?.color ?? "#16a34a"} aria-label="Farbe" className="h-11 w-12 rounded" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="creditsTarget" defaultChecked={t?.creditsTarget ?? true} disabled={t?.system} className="h-5 w-5" />Soll gutschreiben</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="requiresApproval" defaultChecked={t?.requiresApproval ?? true} className="h-5 w-5" />Genehmigung nötig</label>
      {t && (
        <label className="flex items-center gap-1 text-sm">
          <select name="active" defaultValue={t.active ? "on" : "off"} className="rounded border px-2 py-1"><option value="on">aktiv</option><option value="off">inaktiv</option></select>
        </label>
      )}
      {t?.deductsVacation && <span className="text-xs">zieht Urlaub ab</span>}
      <button disabled={pending} className="btn btn-ghost min-h-11 px-4 text-base">{t ? "Speichern" : "Hinzufügen"}</button>
      <FormMessage state={state} />
    </KeepForm>
  );
}

export function AbsenceTypes({ types }: { types: T[] }) {
  return (
    <section className="card">
      <h2 className="mb-2 text-xl font-bold">Abwesenheitsarten</h2>
      {types.map((t) => <TypeRow key={t.id} t={t} />)}
      <TypeRow />
    </section>
  );
}

export function MinStaffingForm({ depts }: { depts: { id: string; name: string; minStaffing: number | null }[] }) {
  const [state, action, pending] = useActionState(saveMinStaffing, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-3">
      <h2 className="text-xl font-bold">Mindestbesetzung</h2>
      <p className="text-sm">Bei Urlaubsanträgen erhält der Genehmiger einen Hinweis, wenn weniger Personen anwesend wären. Keine Sperre.</p>
      <FormMessage state={state} />
      {depts.map((d) => (
        <label key={d.id} className="flex items-center gap-3"><span className="w-56 font-semibold">{d.name}</span>
          <input name={`min_${d.id}`} defaultValue={d.minStaffing ?? ""} inputMode="numeric" aria-label={`Mindestbesetzung ${d.name}`} className="field min-h-11 w-24" /> Personen</label>
      ))}
      <button disabled={pending} className="btn btn-primary self-start">Speichern</button>
    </KeepForm>
  );
}
