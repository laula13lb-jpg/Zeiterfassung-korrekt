"use client";

import { useActionState, useEffect, useState } from "react";
import { previewAbsenceDays } from "@/modules/abwesenheit/absence-actions";
import { FormMessage } from "./FormMessage";
import { KeepForm } from "./KeepForm";

type Act = (prev: { error?: string; ok?: string } | undefined, fd: FormData) => Promise<{ error?: string; ok?: string } | undefined>;

export function AbsenceRequestForm({ types, action, employees, submitLabel = "Beantragen" }: {
  types: { id: string; name: string; code: string; requiresApproval: boolean }[];
  action: Act;
  employees?: { id: string; name: string }[];
  submitLabel?: string;
}) {
  const [state, act, pending] = useActionState(action, undefined);
  const [v, setV] = useState({ start: "", end: "", hs: false, he: false, emp: "" });
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    if (!v.start || (employees && !v.emp)) return setDays(null);
    previewAbsenceDays(v.start, v.end, v.hs, v.he, employees ? v.emp : undefined).then((d) => alive && setDays(d)).catch(() => {});
    return () => { alive = false; };
  }, [v, employees]);
  return (
    <KeepForm action={act} className="card flex flex-col gap-4">
      <FormMessage state={state} />
      {employees && (
        <label><span className="mb-1 block font-semibold">Mitarbeiter</span>
          <select name="employeeId" required value={v.emp} onChange={(e) => setV({ ...v, emp: e.target.value })} className="field">
            <option value="">– bitte wählen –</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></label>
      )}
      <label><span className="mb-1 block font-semibold">Art</span>
        <select name="typeId" defaultValue={types.find((t) => t.code === "URLAUB")?.id} className="field">
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}{!t.requiresApproval ? " (ohne Genehmigung)" : ""}</option>)}
        </select></label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="mb-1 block font-semibold">von</span>
          <input type="date" name="start" required value={v.start} onChange={(e) => setV({ ...v, start: e.target.value, end: v.end && v.end >= e.target.value ? v.end : e.target.value })} className="field" /></label>
        <label><span className="mb-1 block font-semibold">bis</span>
          <input type="date" name="end" required min={v.start} value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} className="field" /></label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="halfDayStart" checked={v.hs} onChange={(e) => setV({ ...v, hs: e.target.checked })} className="h-6 w-6 accent-blau-800" />erster Tag nur halb</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="halfDayEnd" checked={v.he} disabled={!v.end || v.end === v.start} onChange={(e) => setV({ ...v, he: e.target.checked })} className="h-6 w-6 accent-blau-800" />letzter Tag nur halb</label>
      </div>
      {days !== null && (
        <p className="rounded-xl bg-blau-50 p-3 text-lg font-bold" data-testid="tage-vorschau">
          = {days.toLocaleString("de-DE")} {days === 1 ? "Arbeitstag" : "Arbeitstage"} <span className="text-sm font-normal">(ohne Wochenenden, Feiertage und freie Tage)</span>
        </p>
      )}
      <label><span className="mb-1 block font-semibold">Kommentar (optional)</span>
        <input name="comment" maxLength={500} className="field" /></label>
      <button disabled={pending} className="btn btn-accent">{submitLabel}</button>
    </KeepForm>
  );
}
