import Link from "next/link";
import type { MonthAccount } from "@/modules/zeiterfassung/account";
import { berlinDay, dayKey, fmtMinutes } from "@/lib/time";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const hm = (m: number) => fmtMinutes(m, false);
const signed = (m: number) => (m > 0 ? "+" : "") + hm(m);

/** Monatsübersicht Soll/Ist – für Mitarbeiter und Admin */
export function MonthTable({ acc, dayLink, linkLabel }: { acc: MonthAccount; dayLink?: (date: string) => string; linkLabel?: string }) {
  const todayKey = dayKey(berlinDay());
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Übertrag Vormonat" value={signed(acc.openingBalance)} />
        <Stat label="Soll (bisher)" value={hm(acc.targetSum)} />
        <Stat label="Ist (bisher)" value={hm(acc.actualSum)} />
        <Stat label="Saldo" value={signed(acc.closingBalance)} strong />
      </div>
      <div className="card min-w-0 max-w-full overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] text-left text-base">
          <thead className="bg-blau-800 text-sm text-white">
            <tr>
              <th className="px-3 py-2">Tag</th>
              <th className="px-3 py-2 text-right">Soll</th>
              <th className="px-3 py-2 text-right">Ist</th>
              <th className="px-3 py-2 text-right">Diff.</th>
              <th className="px-3 py-2">Hinweis</th>
              {dayLink && <th className="px-3 py-2"><span className="sr-only">Aktion</span></th>}
            </tr>
          </thead>
          <tbody>
            {acc.days.map((d) => {
              const weekend = d.weekday === 0 || d.weekday === 6;
              const notes = [...d.labels];
              if (d.summary?.deductedMinutes) notes.push(`Pause abgezogen ${d.summary.deductedMinutes} Min.`);
              if (d.summary?.notCreditedMinutes) notes.push(`vor Anrechnungsbeginn ${d.summary.notCreditedMinutes} Min.`);
              if (d.corrected) notes.push("korrigiert");
              if (d.autoClosed) notes.push("nicht ausgestempelt");
              if (d.summary?.open) notes.push("läuft");
              return (
                <tr key={d.date} data-date={d.date} className={`border-b border-blau-100 ${weekend || d.holiday ? "bg-blau-50/70 text-blau-900/70" : ""}`}>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{WD[d.weekday]} {d.date.slice(8, 10)}.{d.date.slice(5, 7)}.</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.targetMinutes ? hm(d.targetMinutes) : "–"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.actualMinutes || d.summary ? hm(d.actualMinutes) : "–"}</td>
                  <td className={`px-3 py-2 text-right font-semibold tabular-nums ${d.pending ? "opacity-40" : d.diffMinutes < 0 ? "text-red-700" : d.diffMinutes > 0 ? "text-green-700" : ""}`}>
                    {d.pending ? "" : d.diffMinutes ? signed(d.diffMinutes) : "0:00"}
                  </td>
                  <td className="px-3 py-2 text-sm">{notes.join(" · ")}</td>
                  {dayLink && (
                    <td className="px-3 py-2 text-right">
                      {d.date <= todayKey && (
                        <Link href={dayLink(d.date)} className="font-semibold text-blau-700 underline underline-offset-2">{linkLabel ?? "Bearbeiten"}</Link>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {acc.adjustments.length > 0 && (
        <div className="card">
          <h3 className="mb-2 font-bold">Buchungen auf dem Zeitkonto</h3>
          <ul className="text-base">
            {acc.adjustments.map((a) => (
              <li key={a.id}>{a.date.slice(8, 10)}.{a.date.slice(5, 7)}.: <b>{signed(a.minutes)}</b> ({a.kind.toLowerCase()}) – {a.reason}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="card">
        <h3 className="mb-2 font-bold">Wochensummen</h3>
        <ul className="grid grid-cols-2 gap-2 text-base sm:grid-cols-3">
          {acc.weeks.filter((w) => w.settled).map((w) => (
            <li key={w.week}>KW {w.week}: {hm(w.actualSum)} / {hm(w.targetSum)} <b className={w.diffSum < 0 ? "text-red-700" : "text-green-700"}>({signed(w.diffSum)})</b></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-blau-800 text-white" : "bg-white ring-1 ring-blau-900/10"}`}>
      <div className={`text-sm font-semibold ${strong ? "text-gelb-400" : "text-blau-800"}`}>{label}</div>
      <div className="text-2xl font-black tabular-nums">{value} <span className="text-base font-semibold">Std.</span></div>
    </div>
  );
}

export function MonthNav({ year, month, base }: { year: number; month: number; base: string }) {
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center gap-2">
      <Link href={`${base}${sep}monat=${prev}`} className="btn btn-ghost min-h-12 px-4" aria-label="Vormonat">◀</Link>
      <span className="min-w-44 text-center text-xl font-bold">{name}</span>
      <Link href={`${base}${sep}monat=${next}`} className="btn btn-ghost min-h-12 px-4" aria-label="Folgemonat">▶</Link>
    </div>
  );
}

/** "?monat=2026-11" → Jahr/Monat (Standard: aktueller Monat Berlin) */
export function parseMonth(v: string | undefined): { year: number; month: number } {
  const m = v && /^(\d{4})-(\d{2})$/.exec(v);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { year: Number(m[1]), month: Number(m[2]) };
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}
