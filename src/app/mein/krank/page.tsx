import { db } from "@/lib/db";
import { berlinDay, dayKey, fmtDate } from "@/lib/time";
import { requireEmployee } from "@/modules/auth/guards";
import { SickReportForm, SickExtendForm } from "./SickForms";

export const metadata = { title: "Krankmeldung" };

export default async function Krank() {
  const emp = await requireEmployee();
  const list = await db.sickLeave.findMany({ where: { employeeId: emp.id, cancelledAt: null }, orderBy: { startDate: "desc" }, take: 20 });
  const today = berlinDay();
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Krankmeldung</h1>
      <div className="card border-l-8 border-blau-700 text-base">
        <p><b>So geht&apos;s:</b> Zeitraum eintragen – bitte <b>keine Diagnose</b> oder Gesundheitsangaben. Die Arbeitsunfähigkeitsbescheinigung (AU) ruft das Büro elektronisch bei der Krankenkasse ab (eAU).</p>
        <p className="mt-2">Deine Krankmeldung sehen nur das Büro (Admin) und du. Kollegen und Abteilungsleiter sehen nur „abwesend“.</p>
      </div>
      <SickReportForm today={dayKey(today)} />
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Meine Krankmeldungen</h2>
        {list.length === 0 ? <p>Keine.</p> : (
          <ul className="divide-y divide-blau-100">
            {list.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 py-3" data-testid="meine-krankmeldung">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{fmtDate(s.startDate)} – {fmtDate(s.endDate)}</b>
                  {s.childSick && <span className="rounded bg-blau-100 px-2 text-sm font-bold">Kind krank</span>}
                  <span className="text-sm">{s.eauRetrieved ? "eAU abgerufen" : s.auPresent ? "AU liegt vor" : "AU noch nicht vorliegend"}</span>
                </div>
                {s.endDate >= today && <SickExtendForm id={s.id} end={dayKey(s.endDate)} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
