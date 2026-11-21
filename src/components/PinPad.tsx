"use client";

import { useState } from "react";

/**
 * Großes Zahlenfeld für die PIN-Eingabe (Werkstatt-tauglich).
 * Ungesteuert: schreibt in ein verstecktes Feld `name`.
 * Gesteuert: `value` + `onChange` übergeben.
 */
export function PinPad({ name = "pin", maxLength = 6, value, onChange, dark = false }: {
  name?: string;
  maxLength?: number;
  value?: string;
  onChange?: (v: string) => void;
  dark?: boolean;
}) {
  const [inner, setInner] = useState("");
  const v = value ?? inner;
  const set = (nv: string) => (onChange ? onChange(nv) : setInner(nv));
  const press = (d: string) => v.length < maxLength && set(v + d);
  const key = dark ? "btn h-20 bg-white text-3xl text-blau-900 hover:bg-blau-50" : "btn btn-ghost h-20 text-3xl";
  const aux = dark ? "btn h-20 bg-blau-700 text-white" : "btn h-20 bg-blau-100 text-blau-900";

  return (
    <div className="w-full max-w-sm">
      {value === undefined && <input type="hidden" name={name} value={v} />}
      <div aria-live="polite" aria-label={`${v.length} Ziffern eingegeben`}
        className="mb-4 flex h-16 items-center justify-center gap-3 rounded-2xl bg-white ring-2 ring-blau-800/30">
        {Array.from({ length: Math.max(4, v.length) }).map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < v.length ? "bg-blau-800" : "bg-blau-100"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key}>{d}</button>
        ))}
        <button type="button" onClick={() => set("")} className={`${aux} text-base`}>Löschen</button>
        <button type="button" onClick={() => press("0")} className={key}>0</button>
        <button type="button" aria-label="Letzte Ziffer löschen" onClick={() => set(v.slice(0, -1))} className={`${aux} text-3xl`}>⌫</button>
      </div>
    </div>
  );
}
