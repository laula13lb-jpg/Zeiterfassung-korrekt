import Link from "next/link";
import { db } from "@/lib/db";
import { berlinDay, fmtDate, fmtMinutes, monthName } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { payrollRows } from "@/modules/admin/month-report";
import { CloseMonthForm, ReopenMonthForm } from "./ClosingForms";

export const metadata = { title: "Monatsabschluss & Export" };
const hm = (m: number) => fmtMinutes(m, false);
const sg = (m: number) => (m > 0 ? "+" : "") + hm(m);
const n = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export default async function Auswertung({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  await requireAdmin();
  const today = berlinDay();
  const q = /^(\d{4})-(\d{2})$/.exec((await searchParams).monat ?? "");
  // Standard: Vormonat
  const def = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const year = q ? Number(q[1]) : def.getUTCFullYear();
  const month = q ? Number(q[2]) : def.getUTCMonth() + 1;
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const ended = last < today;
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;

  const [rows, openCorr, openAbs] = await Promise.all([
    payrollRows(year, month),
    db.correctionRequest.count({ where: { status: "BEANTRAGT", workDate: { gte: first, lte: last } } }),
    db.absenceRequest.count({ where: { status: { in: ["BEANTRAGT", "STORNO_BEANTRAGT"] }, startDate: { lte: last }, endDate: { gte: first } } }),
  ]);
  const notClosed = rows.filter((r) => !r.closedAt).map((r) => r.employeeId);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Monatsabschluss & Export</h1>
      <div className="flex items-center gap-2">
        <Link href={`/admin/auswertung?monat=${prev}`} className="btn btn-ghost min-h-12 px-4" aria-label="Vormonat">◀</Link>
        <span className="min-w-44 text-center text-xl font-bold">{monthName(year, month)}</span>
        <Link href={`/admin/auswertung?monat=${next}`} className="btn btn-ghost min-h-12 px-4" aria-label="Folgemonat">▶</Link>
      </div>

      {(openCorr > 0 || openAbs > 0) && (
        <p className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">
          Noch offen in diesem Monat: {openCorr} Korrekturantrag/-anträge, {openAbs} Abwesenheitsantrag/-anträge. <Link href="/admin/postfach" className="underline">Zum Postfach</Link> – bitte vor dem Abschluss erledigen.
        </p>
      )}

      <section className="card flex flex-wrap items-center gap-3">
        <h2 className="w-full text-xl font-bold">Export für die Lohnabrechnung</h2>
        <a href={`/api/export/lohn?monat=${ym}&format=xlsx`} className="btn btn-primary">Excel herunterladen</a>
        <a href={`/api/export/lohn?monat=${ym}`} className="btn btn-ghost">CSV herunterladen</a>
        <span className="w-full text-sm">Ist-Stunden, Mehr-/Minderstunden, Saldo, Urlaubs-, Krankheits- und Feiertage je Mitarbeiter. Spalten sind für einen späteren DATEV-Lohnexport vorbereitet.</span>
      </section>

      <div className="card min-w-0 max-w-full overflow-x-auto p-0">
        <table className="w-full min-w-[56rem] text-left text-base">
          <thead className="bg-blau-800 text-sm text-white">
            <tr>
              <th className="px-3 py-2">Name</th><th className="px-3 py-2 text-right">Soll</th><th className="px-3 py-2 text-right">Ist</th>
              <th className="px-3 py-2 text-right">Diff.</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2 text-right">Urlaub</th>
              <th className="px-3 py-2 text-right">Krank</th><th className="px-3 py-2 text-right">Feiert.</th><th className="px-3 py-2">Abschluss</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employeeId} className="border-b border-blau-100 align-top" data-testid="abschluss-zeile">
                <td className="px-3 py-2 font-semibold">{r.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{hm(r.targetMinutes)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{hm(r.actualMinutes)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.diffMinutes < 0 ? "text-red-700" : ""}`}>{sg(r.diffMinutes)}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">{sg(r.closingBalance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(r.vacationDays)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.sickDays}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.holidayDays}</td>
                <td className="px-3 py-2 text-sm">
                  {r.closedAt ? <>✔ {fmtDate(r.closedAt)}{r.employeeConfirmedAt ? <><br />bestätigt {fmtDate(r.employeeConfirmedAt)}</> : <><br />Bestätigung offen</>}</> : "offen"}
                  {r.closedAt && <ReopenMonthForm employeeId={r.employeeId} monat={ym} />}
                </td>
                <td className="px-3 py-2 text-right">
                  <a href={`/api/export/monatsnachweis?mitarbeiter=${r.employeeId}&monat=${ym}`} className="font-semibold text-blau-700 underline">PDF</a>
                  {!r.closedAt && ended && <CloseMonthForm ids={[r.employeeId]} monat={ym} label="abschließen" small />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ended ? (
        notClosed.length > 0 && <CloseMonthForm ids={notClosed} monat={ym} label={`Alle ${notClosed.length} offenen Monatsnachweise abschließen`} />
      ) : (
        <p className="text-sm">Der Monat ist noch nicht vorbei – Abschluss erst danach möglich. Werte bis gestern.</p>
      )}
      <p className="text-sm">Nach dem Abschluss sind Änderungen an Zeiten, Abwesenheiten und Krankmeldungen dieses Monats gesperrt. Muss doch etwas geändert werden: „wieder öffnen“ (mit Begründung), ändern, erneut abschließen.</p>
    </div>
  );
}
