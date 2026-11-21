import { requireEmployee } from "@/modules/auth/guards";
import { clientIp } from "@/lib/request";
import { fmt, fmtMinutes, fmtTime } from "@/lib/time";
import { getDayView } from "@/modules/zeiterfassung/day";
import { personalStampAllowed } from "@/modules/zeiterfassung/personal-actions";
import { getSettings } from "@/modules/admin/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { StampButtons } from "./StampButtons";
import Link from "next/link";
import { db } from "@/lib/db";
import { currentBalance } from "@/modules/zeiterfassung/account";
import { markNotificationsRead } from "@/modules/notifications";

export const metadata = { title: "Heute" };

export default async function MeinStart() {
  const emp = await requireEmployee();
  if (!emp.tracksTime) {
    return <h1 className="text-3xl font-extrabold">Hallo {emp.firstName}!</h1>;
  }
  const [day, perm, settings, balance, notes] = await Promise.all([
    getDayView(emp.id),
    personalStampAllowed(await clientIp()),
    getSettings(),
    currentBalance(emp.id),
    db.notification.findMany({ where: { employeeId: emp.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const s = day.summary;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold">Hallo {emp.firstName}!</h1>
        <p className="text-lg">{fmt(new Date(), "EEEE, d. MMMM yyyy")}</p>
      </div>

      {notes.length > 0 && (
        <section className="card border-l-8 border-gelb-500" aria-label="Neuigkeiten">
          <h2 className="mb-2 text-xl font-bold">Neuigkeiten</h2>
          <ul className="mb-3 flex flex-col gap-1">
            {notes.map((n) => (
              <li key={n.id}>{n.link ? <Link href={n.link} className="font-semibold underline">{n.title}</Link> : <b>{n.title}</b>}{n.body ? ` – ${n.body}` : ""}</li>
            ))}
          </ul>
          <form action={markNotificationsRead}><button className="btn btn-ghost min-h-10 px-4 text-sm">Als gelesen markieren</button></form>
        </section>
      )}

      <section className="card flex flex-col gap-4" aria-label="Status">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={day.status} />
          {day.since && <span className="text-lg font-semibold">{day.status === "PAUSE" ? "Pause" : "Eingestempelt"} seit {fmtTime(day.since)}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-blau-50 p-3"><dt className="text-sm font-semibold text-blau-800">Arbeitszeit heute</dt><dd className="text-3xl font-black tabular-nums">{fmtMinutes(s.netWorkMinutes, false)}</dd></div>
          <div className="rounded-xl bg-blau-50 p-3"><dt className="text-sm font-semibold text-blau-800">Pause heute</dt><dd className="text-3xl font-black tabular-nums">{fmtMinutes(s.breakMinutes, false)}</dd></div>
          <Link href="/mein/zeiten" className="rounded-xl bg-blau-800 p-3 text-white"><dt className="text-sm font-semibold text-gelb-400">Zeitkonto (bis gestern)</dt><dd className="text-3xl font-black tabular-nums">{balance > 0 ? "+" : ""}{fmtMinutes(balance, false)}</dd></Link>
        </dl>
        {day.stale && (
          <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-800 ring-2 ring-red-700">
            Du hast an einem früheren Tag nicht ausgestempelt. Die Buchung wird beim nächsten Stempeln mit 0 Std. geschlossen –
            bitte einen Korrekturantrag stellen oder im Büro melden.
          </p>
        )}
        {s.deductedMinutes > 0 && (
          <p className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">
            Pause nicht (vollständig) gestempelt: {s.deductedMinutes} Min. werden automatisch abgezogen
            (vorgeschrieben: {s.requiredBreakMinutes} Min. Pause bei {fmtMinutes(s.workMinutes)} Arbeit).
          </p>
        )}
        {s.deductedMinutes === 0 && s.missingBreakMinutes > 0 && (
          <p className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">
            Hinweis Pausenregel: Bei {fmtMinutes(s.workMinutes)} Arbeitszeit sind mindestens {s.requiredBreakMinutes} Min. Pause vorgeschrieben
            (Blöcke ab 15 Min.). Es fehlen noch {s.missingBreakMinutes} Min.
          </p>
        )}
        {s.notCreditedMinutes > 0 && (
          <p className="text-base">
            Vor {settings.creditFromTime} Uhr gearbeitet: {fmtMinutes(s.notCreditedMinutes)} – zählt nicht als Arbeitszeit/Überstunde.
          </p>
        )}
        {perm.allowed ? (
          <StampButtons allowed={day.allowed} />
        ) : (
          <p className="rounded-xl bg-blau-100 p-3 font-semibold">{perm.reason}</p>
        )}
      </section>

      <section className="card" aria-label="Heutige Buchungen">
        <h2 className="mb-3 text-xl font-bold">Heutige Buchungen</h2>
        {day.entries.length === 0 ? (
          <p>Heute noch keine Buchungen.</p>
        ) : (
          <ul className="divide-y divide-blau-100">
            {day.entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-lg">
                <span className={`font-semibold ${e.kind === "PAUSE" ? "text-amber-700" : ""}`}>{e.kind === "PAUSE" ? "Pause" : "Arbeit"}</span>
                <span className="tabular-nums">
                  {fmtTime(e.start)} – {e.end ? fmtTime(e.end) : "läuft"}
                </span>
                {e.origin === "OFFLINE" && <span className="rounded bg-blau-100 px-2 text-xs font-bold">offline erfasst</span>}
                {e.autoClosed && <span className="rounded bg-red-100 px-2 text-xs font-bold text-red-800">nicht ausgestempelt</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
