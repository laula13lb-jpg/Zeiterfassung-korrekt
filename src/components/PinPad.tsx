"use client";

import { useState } from "react";

/**
 * Großes Zahlenfeld für die PIN-Eingabe (Werkstatt-tauglich).
 * Schreibt den Wert in ein verstecktes Feld `name`.
 */
export function PinPad({ name = "pin", maxLength = 6 }: { name?: string; maxLength?: number }) {
  const [value, setValue] = useState("");

  const press = (d: string) => {
    setValue((v) => (v.length < maxLength ? v + d : v));
  };

  return (
    <div className="w-full max-w-sm">
      <input type="hidden" name={name} value={value} />
      <div aria-live="polite" aria-label={`${value.length} Ziffern eingegeben`}
        className="mb-4 flex h-16 items-center justify-center gap-3 rounded-2xl bg-white ring-2 ring-blau-800/30">
        {Array.from({ length: Math.max(4, value.length) }).map((_, i) => (
          <span key={i} className={`h-4 w-4 rounded-full ${i < value.length ? "bg-blau-800" : "bg-blau-100"}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="btn btn-ghost h-20 text-3xl">
            {d}
          </button>
        ))}
        <button type="button" onClick={() => setValue("")} className="btn h-20 bg-blau-100 text-base text-blau-900">
          Löschen
        </button>
        <button type="button" onClick={() => press("0")} className="btn btn-ghost h-20 text-3xl">
          0
        </button>
        <button type="button" aria-label="Letzte Ziffer löschen" onClick={() => setValue((v) => v.slice(0, -1))} className="btn h-20 bg-blau-100 text-3xl text-blau-900">
          ⌫
        </button>
      </div>
    </div>
  );
}
