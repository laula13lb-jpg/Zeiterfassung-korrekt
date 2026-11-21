"use client";

import { useActionState } from "react";
import { saveRounding } from "@/modules/admin/calendar-admin";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function RoundingForm({ value }: { value: number }) {
  const [state, action, pending] = useActionState(saveRounding, undefined);
  return (
    <KeepForm action={action} className="card flex flex-col gap-3">
      <h2 className="text-xl font-bold">Rundung</h2>
      <FormMessage state={state} />
      <label><span className="mb-1 block font-semibold">Tägliche Arbeitszeit abrunden auf</span>
        <select name="roundingMinutes" defaultValue={String(value)} className="field max-w-64">
          <option value="0">keine Rundung (empfohlen)</option>
          <option value="5">volle 5 Minuten</option>
          <option value="10">volle 10 Minuten</option>
          <option value="15">volle 15 Minuten</option>
        </select></label>
      <button disabled={pending} className="btn btn-primary self-start">Speichern</button>
    </KeepForm>
  );
}
