"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { activateTerminal } from "@/modules/zeiterfassung/terminal-actions";
import { Brand } from "@/components/Brand";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function ActivateTerminal() {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_p: { error?: string; done?: boolean } | undefined, fd: FormData): Promise<{ error?: string; done?: boolean }> =>
      (await activateTerminal(undefined, fd)) ?? { done: true },
    undefined,
  );
  useEffect(() => {
    if (state?.done) router.refresh();
  }, [state, router]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-blau-900 p-6 text-white">
      <Brand subtitle="Werkstatt-Terminal einrichten" />
      <KeepForm action={action} className="card flex w-full max-w-md flex-col gap-4 text-blau-950">
        <p>Dieses Gerät ist noch nicht als Terminal freigeschaltet. Den <b>Freischaltcode</b> erzeugen Sie im Admin-Bereich unter <b>„Terminals“</b>.</p>
        <FormMessage state={state} />
        <input name="code" required autoCapitalize="characters" autoComplete="off" placeholder="XXXX-XXXX" aria-label="Freischaltcode"
          className="field text-center text-2xl font-bold uppercase tracking-widest" />
        <button disabled={pending} className="btn btn-accent">Terminal freischalten</button>
      </KeepForm>
    </main>
  );
}
