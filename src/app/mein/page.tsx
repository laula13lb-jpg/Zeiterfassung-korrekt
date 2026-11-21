import { requireEmployee } from "@/modules/auth/guards";
import { clientIp } from "@/lib/request";
import { fmt, fmtMinutes, fmtTime } from "@/lib/time";
import { getDayView } from "@/modules/zeiterfassung/day";
import { personalStampAllowed } from "@/modules/zeiterfassung/personal-actions";
import { getSettings } from "@/modules/admin/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { StampButtons } from "./StampButtons";

export const metadata = { title: "Heute" };

export default async function MeinStart() {
  const emp = await requireEmployee();
  if (!emp.tracksTime) {
    return <h1 className="text-3xl font-extrabold">Hallo {emp.firstName}!</h1>;
  }
  const [day, perm, settings] = await Promise.all([getDayView(emp.id), personalStampAllowed(await clientIp()), getSettings()]);
  const s = day.summary;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold">Hallo {emp.firstName}!</h1>
        <p className="text-lg">{fmt(new Date(), "EEEE, d. MMMM yyyy")}</p>
      </div>

      <section className="card flex flex-col gap-4" aria-label="Status">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={day.status} />
          {day.since && <span className="text-lg font-semibold">{day.status === "PAUSE" ? "Pause" : "Eingestempelt"} seit {fmtTime(day.since)}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-blau-50 p-3"><dt className="text-sm font-semibold text-blau-800">Arbeitszeit heute</dt><dd className="text-3xl font-black tabular-nums">{fmtMinutes(s.netWorkMinutes, false)}</dd></div>
          <div className="rounded-xl bg-blau-50 p-3"><dt className="text-sm font-semibold text-blau-800">Pause heute</dt><dd className="text-3xl font-black tabular-nums">{fmtMinutes(s.breakMinutes, false)}</dd></div>
          {s.firstStart && <div className="rounded-xl bg-blau-50 p-3"><dt className="text-sm font-semibold text-blau-800">Erste Stempelung</dt><dd className="text-3xl font-black tabular-nums">{fmtTime(s.firstStart)}</dd></div>}
        </dl>
        {s.missingBreakMinutes > 0 && (
          <p className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">
            Hinweis Pausenregel: Bei {fmtMinutes(s.workMinutes)} Arbeitszeit sind mindestens {s.requiredBreakMinutes} Min. Pause vorgeschrieben
            (Blöcke ab 15 Min.). Es fehlen noch {s.missingBreakMinutes} Min.
            {settings.missingBreakMode === "abzug" ? " Fehlende Pause wird nach dem Ausstempeln automatisch abgezogen." : ""}
          </p>
        )}
        {s.deductedMinutes > 0 && <p className="text-sm">Automatisch abgezogen (fehlende Pause): {s.deductedMinutes} Min.</p>}
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
