"use client";

import { useActionState } from "react";
import { createTerminalCode } from "@/modules/admin/terminal-admin";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function TerminalCodeForm({ id, label }: { id?: string; label?: string }) {
  const [state, action, pending] = useActionState(createTerminalCode, undefined);
  return (
    <KeepForm action={action} className={id ? "flex flex-col gap-2" : "card flex flex-col gap-3"}>
      {id ? <input type="hidden" name="id" value={id} /> : (
        <label><span className="mb-1 block font-semibold">Name des neuen Terminals</span>
          <input name="name" defaultValue="Werkstatt-Tablet" className="field" /></label>
      )}
      <FormMessage state={state} />
      {state?.code && (
        <div role="status" className="rounded-xl bg-gelb-100 p-3 ring-2 ring-gelb-500">
          Freischaltcode für „{state.name}“: <span data-testid="terminal-code" className="font-mono text-2xl font-black tracking-widest">{state.code}</span>
          <div className="text-sm">gültig 24 Stunden</div>
        </div>
      )}
      <button disabled={pending} className={id ? "btn btn-ghost min-h-12 text-base" : "btn btn-primary"}>{label ?? "Terminal anlegen & Code erzeugen"}</button>
    </KeepForm>
  );
}
