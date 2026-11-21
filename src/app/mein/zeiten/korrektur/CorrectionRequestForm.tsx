"use client";

import { useActionState } from "react";
import { requestCorrection } from "@/modules/zeiterfassung/correction-actions";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

type D = { kommen: string; gehen: string; p1von: string; p1bis: string; p2von: string; p2bis: string };

export function CorrectionRequestForm({ datum, defaults }: { datum: string; defaults: D }) {
  const [state, action, pending] = useActionState(requestCorrection, undefined);
  const t = (name: keyof D, label: string) => (
    <label className="flex-1"><span className="mb-1 block font-semibold">{label}</span>
      <input name={name} type="time" defaultValue={defaults[name]} className="field" /></label>
  );
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <input type="hidden" name="datum" value={datum} />
      <FormMessage state={state} />
      <div className="flex gap-3">{t("kommen", "Kommen")}{t("gehen", "Gehen")}</div>
      <div className="flex gap-3">{t("p1von", "1. Pause von")}{t("p1bis", "bis")}</div>
      <div className="flex gap-3">{t("p2von", "2. Pause von")}{t("p2bis", "bis")}</div>
      <label><span className="mb-1 block font-semibold">Was war los?</span>
        <textarea name="message" required rows={3} placeholder="z. B. vergessen auszustempeln, war bis 16:45 da" className="field py-3" /></label>
      <button disabled={pending} className="btn btn-accent">Antrag stellen</button>
    </KeepForm>
  );
}
