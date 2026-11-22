import Link from "next/link";
import { db } from "@/lib/db";
import { berlinDay, dayKey, fmtDate } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { pendingVacationRefunds, sickStatistics } from "@/modules/abwesenheit/sick";
import { AdminSickForm, CancelSickForm, RefundForm } from "./AdminSickForms";

export const metadata = { title: "Krankheit" };
const n = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export default async function Krankheit({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  await requireAdmin();
  const today = berlinDay();
  const year = Number((await searchParams).jahr) || today.getUTCFullYear();
  const [employees, current, refunds, stats] = await Promise.all([
    db.employee.findMany({ where: { status: "AKTIV", tracksTime: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    db.sickLeave.findMany({
      where: { cancelledAt: null, endDate: { gte: new Date(today.getTime() - 60 * 86_400_000) } },
      include: { employee: true },
      orderBy: { startDate: "desc" },
    }),
    pendingVacationRefunds(),
    sickStatistics(year),
  ]);
  const hints = stats.filter((s) => s.efzgReached || s.bemRecommended);
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Krankheit</h1>
      <p className="text-sm">Vertraulich: Diese Seite sehen nur Admins. Es werden nur Zeiträume und der AU-Status gespeichert – keine Diagnosen, keine Bescheinigungen.</p>

      {refunds.length > 0 && (
        <section className="card border-l-8 border-gelb-500">
          <h2 className="mb-2 text-xl font-bold">Krank während genehmigtem Urlaub</h2>
          <p className="mb-2 text-sm">Urlaubstage werden nur zurückgebucht, wenn die Arbeitsunfähigkeit nachgewiesen ist (§ 9 BUrlG). Bitte prüfen und bestätigen.</p>
          <ul className="divide-y divide-blau-100">
            {refunds.map((r) => (
              <li key={r.sickId} className="flex flex-wrap items-center gap-3 py-2" data-testid="rueckbuchung">
                <b>{r.name}</b><span>{fmtDate(r.start)} – {fmtDate(r.end)}</span>
                <span>{n(r.days)} Urlaubstage betroffen</span>
                <span className={`text-sm ${r.auPresent ? "text-green-800" : "font-bold text-red-700"}`}>{r.auPresent ? "AU liegt vor" : "AU fehlt noch"}</span>
                <span className="ml-auto"><RefundForm id={r.sickId} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hints.length > 0 && (
        <section className="card border-l-8 border-red-700">
          <h2 className="mb-2 text-xl font-bold">Hinweise</h2>
          <ul className="flex flex-col gap-1" data-testid="krankheit-hinweise">
            {hints.map((h) => (
              <li key={h.id}>
                <b>{h.name}</b>:{" "}
                {h.efzgReached && <>6 Wochen am Stück erreicht ({h.longestEpisode} Tage) – Entgeltfortzahlung prüfen (dieselbe Erkrankung? ggf. Krankengeld). </>}
                {h.bemRecommended && <>mehr als 6 Wochen in 12 Monaten ({h.last12Months} Tage) – Betriebliches Eingliederungsmanagement (BEM) anbieten.</>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Krankmeldung erfassen</h2>
        <AdminSickForm employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))} today={dayKey(today)} />
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Aktuelle und letzte Krankmeldungen</h2>
        {current.length === 0 ? <p>Keine.</p> : (
          <ul className="divide-y divide-blau-100">
            {current.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3" data-testid="krankmeldung">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{s.employee.firstName} {s.employee.lastName}</b>
                  {s.childSick && <span className="rounded bg-blau-100 px-2 text-sm font-bold">Kind krank</span>}
                  {s.startDate <= today && s.endDate >= today && <span className="rounded bg-red-700 px-2 text-sm font-bold text-white">aktuell</span>}
                </div>
                <AdminSickForm sick={{ id: s.id, start: dayKey(s.startDate), end: dayKey(s.endDate), auPresent: s.auPresent, eauRetrieved: s.eauRetrieved, childSick: s.childSick }} />
                <CancelSickForm id={s.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">Auswertung {year}</h2>
          <Link href={`/admin/krankheit?jahr=${year - 1}`} className="btn btn-ghost min-h-10 px-3" aria-label="Vorjahr">◀</Link>
          <Link href={`/admin/krankheit?jahr=${year + 1}`} className="btn btn-ghost min-h-10 px-3" aria-label="Folgejahr">▶</Link>
        </div>
        <div className="card min-w-0 max-w-full overflow-x-auto p-0">
          <table className="w-full min-w-[36rem] text-left">
            <thead className="bg-blau-800 text-sm text-white">
              <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2 text-right">Kalendertage</th><th className="px-3 py-2 text-right">Arbeitstage</th><th className="px-3 py-2 text-right">Kind krank (AT)</th><th className="px-3 py-2 text-right">letzte 12 Monate</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-blau-100">
                  <td className="px-3 py-2 font-semibold">{s.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.calendarDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(s.workdays)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{n(s.childWorkdays)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.bemRecommended ? "font-bold text-red-700" : ""}`}>{s.last12Months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
