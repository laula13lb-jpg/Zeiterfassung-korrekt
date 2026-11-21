"use client";

import { useActionState, useEffect, useState } from "react";
import { loginWithPin } from "@/modules/auth/actions";
import { PinPad } from "@/components/PinPad";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

type Group = { name: string; people: { id: string; name: string }[] };

export function EmployeeLogin({ groups }: { groups: Group[] }) {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [byNumber, setByNumber] = useState(false);
  const [state, action, pending] = useActionState(loginWithPin, undefined);
  // nach jedem Fehlversuch PIN-Feld leeren
  const [padKey, setPadKey] = useState(0);
  useEffect(() => setPadKey((k) => k + 1), [state]);

  if (!selected && !byNumber) {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold">Wer bist du?</h1>
        {groups.map((g) => (
          <div key={g.name}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-blau-800">{g.name}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.people.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelected(p)} className="btn btn-ghost justify-start text-left">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setByNumber(true)} className="btn bg-blau-100 text-blau-900">
          Mit Personalnummer anmelden
        </button>
      </section>
    );
  }

  return (
    <KeepForm action={action} className="flex flex-col items-center gap-5">
      {selected ? (
        <>
          <input type="hidden" name="employeeId" value={selected.id} />
          <h1 className="text-2xl font-extrabold">Hallo {selected.name.split(" ")[0]}!</h1>
        </>
      ) : (
        <label className="w-full max-w-sm">
          <span className="mb-1 block font-semibold">Personalnummer</span>
          <input name="personnelNo" inputMode="numeric" autoComplete="username" required className="field" />
        </label>
      )}
      <p className="text-lg">Bitte PIN eingeben</p>
      <div className="w-full max-w-sm"><FormMessage state={state} /></div>
      <PinPad key={padKey} />
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        <button type="button" onClick={() => { setSelected(null); setByNumber(false); }} className="btn bg-blau-100 text-blau-900">
          Zurück
        </button>
        <button type="submit" disabled={pending} className="btn btn-accent">
          {pending ? "Prüfe…" : "Anmelden"}
        </button>
      </div>
    </KeepForm>
  );
}
