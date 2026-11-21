"use client";

import { useActionState, useState } from "react";
import { adminCorrectDay } from "@/modules/zeiterfassung/correction-actions";
import type { BlockInput } from "@/modules/zeiterfassung/blocks";
import { FormMessage } from "@/components/FormMessage";
import { KeepForm } from "@/components/KeepForm";

export function DayEditor({ employeeId, datum, initial }: { employeeId: string; datum: string; initial: BlockInput[] }) {
  const [rows, setRows] = useState<BlockInput[]>(initial);
  const [state, action, pending] = useActionState(adminCorrectDay, undefined);
  const set = (i: number, patch: Partial<BlockInput>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => {
    const last = rows.at(-1);
    setRows((r) => [...r, { kind: last ? (last.kind === "ARBEIT" ? "PAUSE" : "ARBEIT") : "ARBEIT", start: last?.end ?? "07:00", end: "" }]);
  };
  return (
    <KeepForm action={action} className="card flex flex-col gap-4">
      <h2 className="text-xl font-bold">Buchungen korrigieren</h2>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="datum" value={datum} />
      <input type="hidden" name="blocks" value={JSON.stringify(rows.map((r) => ({ ...r, end: r.end || null })))} />
      <FormMessage state={state} />
      {rows.length === 0 && <p>Keine Buchungen (der Tag wird leer gespeichert).</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2" data-testid="block-zeile">
          <label><span className="mb-1 block text-sm font-semibold">Art</span>
            <select value={r.kind} onChange={(e) => set(i, { kind: e.target.value as BlockInput["kind"] })} aria-label={`Art Zeile ${i + 1}`} className="field min-h-12 w-32">
              <option value="ARBEIT">Arbeit</option><option value="PAUSE">Pause</option>
            </select></label>
          <label><span className="mb-1 block text-sm font-semibold">von</span>
            <input type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} aria-label={`von Zeile ${i + 1}`} className="field min-h-12 w-32" /></label>
          <label><span className="mb-1 block text-sm font-semibold">bis</span>
            <input type="time" value={r.end ?? ""} onChange={(e) => set(i, { end: e.target.value })} aria-label={`bis Zeile ${i + 1}`} className="field min-h-12 w-32" /></label>
          <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="btn min-h-12 bg-red-50 px-4 text-base text-red-800">Entfernen</button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn btn-ghost min-h-12 self-start text-base">+ Zeile hinzufügen</button>
      <label><span className="mb-1 block font-semibold">Begründung (Pflicht)</span>
        <input name="reason" required minLength={5} className="field" placeholder="z. B. Mitarbeiter hat vergessen auszustempeln, laut Rücksprache bis 16:45" /></label>
      <button disabled={pending} className="btn btn-primary">Speichern</button>
    </KeepForm>
  );
}
