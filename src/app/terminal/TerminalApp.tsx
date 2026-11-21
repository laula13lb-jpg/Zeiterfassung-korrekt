"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Clock } from "@/components/Clock";
import { PinPad } from "@/components/PinPad";
import { terminalStamp, terminalVerifyPin, type TerminalPerson } from "@/modules/zeiterfassung/terminal-actions";
import { STAMP_LABEL, type StampType } from "@/modules/zeiterfassung/rules";

type Group = { name: string; people: { id: string; name: string }[] };
type Screen =
  | { s: "start" }
  | { s: "pin"; id: string; name: string }
  | { s: "actions"; person: TerminalPerson }
  | { s: "done"; message: string; notice?: string; type: StampType };

const IDLE_MS = 30_000;
const DONE_MS = 5_000;

const STYLE: Record<StampType, string> = {
  KOMMEN: "bg-green-600 text-white hover:bg-green-500",
  PAUSE_START: "bg-gelb-500 text-blau-950 hover:bg-gelb-400",
  PAUSE_ENDE: "bg-blau-600 text-white hover:bg-blau-700",
  GEHEN: "bg-red-700 text-white hover:bg-red-600",
};

const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

export function TerminalApp({ groups, serverNow, terminalName }: { groups: Group[]; serverNow: number; terminalName: string }) {
  const [screen, setScreen] = useState<Screen>({ s: "start" });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setScreen({ s: "start" });
    setPin("");
    setError(null);
  }, []);

  // automatische Rückkehr zum Startbildschirm
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (screen.s !== "start") timer.current = setTimeout(reset, screen.s === "done" ? DONE_MS : IDLE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [screen, pin, reset]);

  const submitPin = () => {
    if (screen.s !== "pin" || pin.length < 4) return;
    const id = screen.id;
    start(async () => {
      const r = await terminalVerifyPin(id, pin);
      setPin("");
      if (!r.ok) return setError(r.error);
      setError(null);
      setScreen({ s: "actions", person: r.person });
    });
  };

  const stamp = (type: StampType) => {
    if (screen.s !== "actions") return;
    const token = screen.person.token;
    start(async () => {
      const r = await terminalStamp(token, type, crypto.randomUUID());
      if (!r.ok) return setError(r.error);
      setError(null);
      setScreen({ s: "done", message: r.message, notice: r.notice, type });
    });
  };

  return (
    <main className="flex min-h-dvh flex-col bg-blau-900 text-white select-none">
      {screen.s === "start" && (
        <div className="flex flex-1 flex-col gap-6 p-6 lg:flex-row">
          <div className="flex flex-col items-center justify-center gap-2 text-center lg:w-2/5">
            <div className="mb-4 rounded-xl bg-gelb-500 px-4 py-1 text-lg font-black text-blau-950">Autoklinik Bludau</div>
            <Clock serverNow={serverNow} className="text-7xl lg:text-8xl" />
            <p className="mt-6 text-2xl font-semibold text-gelb-400">Bitte Namen antippen</p>
          </div>
          <div className="flex-1 overflow-y-auto rounded-3xl bg-blau-950/40 p-4">
            {groups.map((g) => (
              <section key={g.name} className="mb-5">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gelb-400">{g.name}</h2>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                  {g.people.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setError(null); setScreen({ s: "pin", id: p.id, name: p.name }); }}
                      className="btn min-h-20 bg-white text-xl text-blau-900 hover:bg-blau-50">
                      {p.name}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {screen.s === "pin" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          <h1 className="text-3xl font-extrabold">Hallo {screen.name.split(" ")[0]}!</h1>
          <p className="text-xl">Bitte PIN eingeben</p>
          {error && <p role="alert" className="max-w-sm rounded-xl bg-red-100 px-4 py-3 text-center text-lg font-bold text-red-800">{error}</p>}
          <PinPad value={pin} onChange={setPin} dark />
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            <button type="button" onClick={reset} className="btn min-h-16 bg-blau-700 text-white">Abbrechen</button>
            <button type="button" onClick={submitPin} disabled={pending || pin.length < 4} className="btn btn-accent min-h-16 text-xl">
              {pending ? "Prüfe…" : "Weiter"}
            </button>
          </div>
        </div>
      )}

      {screen.s === "actions" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <h1 className="text-4xl font-extrabold">Hallo {screen.person.firstName}!</h1>
          <p className="text-center text-2xl">
            {screen.person.status === "ABWESEND" && "Du bist nicht eingestempelt."}
            {screen.person.status === "ARBEIT" && `Eingestempelt seit ${screen.person.since}`}
            {screen.person.status === "PAUSE" && `In Pause seit ${screen.person.since}`}
            <br />
            <span className="text-xl opacity-90">Heute: {hm(screen.person.workMinutes)} Std. Arbeit · {hm(screen.person.breakMinutes)} Std. Pause</span>
          </p>
          {screen.person.staleNotice && <p className="max-w-2xl rounded-xl bg-gelb-500 px-4 py-3 text-center text-xl font-bold text-blau-950">{screen.person.staleNotice}</p>}
          {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-lg font-bold text-red-800">{error}</p>}
          <div className="flex w-full max-w-3xl flex-wrap justify-center gap-4">
            {screen.person.allowed.map((t) => (
              <button key={t} type="button" disabled={pending} onClick={() => stamp(t)} className={`btn min-h-32 w-full text-4xl sm:w-[22rem] ${STYLE[t]}`}>
                {STAMP_LABEL[t]}
              </button>
            ))}
          </div>
          <button type="button" onClick={reset} className="btn min-h-16 bg-blau-700 px-10 text-white">Abbrechen</button>
        </div>
      )}

      {screen.s === "done" && (
        <button type="button" onClick={reset} className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <div aria-hidden className={`grid h-32 w-32 place-items-center rounded-full text-7xl ${STYLE[screen.type]}`}>✓</div>
          <p role="status" className="text-4xl font-extrabold leading-tight">{screen.message}</p>
          {screen.notice && <p className="max-w-xl rounded-xl bg-gelb-500 px-4 py-3 text-xl font-bold text-blau-950">{screen.notice}</p>}
          <p className="text-lg opacity-80">Tippen zum Fortfahren</p>
        </button>
      )}

      <footer className="px-4 pb-2 text-right text-xs opacity-50">{terminalName}</footer>
    </main>
  );
}
