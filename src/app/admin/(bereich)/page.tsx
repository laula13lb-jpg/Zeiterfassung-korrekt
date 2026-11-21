import Link from "next/link";
import { requireAdmin } from "@/modules/auth/guards";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { getSettings } from "@/modules/admin/settings";
import { resolveWarning } from "@/modules/zeiterfassung/correction-actions";
import { WARNING_LABEL } from "@/modules/zeiterfassung/warnings";

export const metadata = { title: "Verwaltung" };

export default async function AdminStart() {
  const { employee } = await requireAdmin();
  const [active, openRequests, warnings, settings] = await Promise.all([
    db.employee.count({ where: { status: "AKTIV", tracksTime: true } }),
    db.correctionRequest.count({ where: { status: "BEANTRAGT" } }),
    db.timeWarning.findMany({
      where: { resolvedAt: null },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { workDate: "desc" },
      take: 50,
    }),
    getSettings(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Übersicht</h1>
      {!employee.totpEnabled && (
        <div className="card border-l-8 border-gelb-500">
          <p className="font-semibold">Empfehlung: Schalten Sie die Zwei-Faktor-Anmeldung (2FA) für Ihren Admin-Zugang ein.</p>
          <Link href="/admin/sicherheit" className="btn btn-primary mt-3">2FA einrichten</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="text-sm font-semibold uppercase text-blau-800">Aktive Mitarbeiter</div><div className="text-4xl font-black">{active}</div></div>
        <Link href="/admin/postfach" className="card hover:ring-2 hover:ring-blau-700"><div className="text-sm font-semibold uppercase text-blau-800">Offene Anträge</div><div className="text-4xl font-black">{openRequests}</div></Link>
        <div className="card"><div className="text-sm font-semibold uppercase text-blau-800">Stempeln vom Handy</div><div className="text-2xl font-black">{settings.stampFromPersonalDevices ? "erlaubt" : "nur Terminal"}</div></div>
      </div>
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Hinweise Arbeitszeitgesetz ({warnings.length})</h2>
        {warnings.length === 0 ? <p>Keine offenen Hinweise.</p> : (
          <ul className="divide-y divide-blau-100">
            {warnings.map((w) => {
              const d = w.workDate.toISOString().slice(0, 10);
              return (
                <li key={w.id} className="flex flex-wrap items-center gap-3 py-2" data-testid="warnung">
                  <span className="rounded-full bg-gelb-500 px-3 py-0.5 text-sm font-bold text-blau-950">{WARNING_LABEL[w.type]}</span>
                  <span className="font-semibold">{w.employee.firstName} {w.employee.lastName}</span>
                  <span>{fmtDate(w.workDate)}</span>
                  <span className="flex-1 text-sm">{w.details}</span>
                  <Link href={`/admin/zeiten/${w.employee.id}/${d}`} className="font-semibold text-blau-700 underline">Tag ansehen</Link>
                  <form action={resolveWarning.bind(null, w.id)}><button className="btn btn-ghost min-h-10 px-3 text-sm">Erledigt</button></form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="text-sm"><Link href="/admin/mitarbeiter" className="underline">Zeitkonten mit Ampel ansehen →</Link></p>
    </div>
  );
}
