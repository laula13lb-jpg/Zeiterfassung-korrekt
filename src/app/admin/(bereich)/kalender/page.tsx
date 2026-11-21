import Link from "next/link";
import { db } from "@/lib/db";
import { fmt, fmtDate } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { addChristmasHalfDays, removeCompanyDay } from "@/modules/admin/calendar-admin";
import { holidaysNiedersachsen } from "@/modules/zeiterfassung/holidays";
import { CompanyDayForm } from "./CompanyDayForm";

export const metadata = { title: "Feiertage & Betriebstage" };
const KIND: Record<string, string> = { HALBER_TAG: "halber Tag", BETRIEBSFERIEN: "Betriebsferien", FREIER_TAG: "freier Tag" };

export default async function Kalender({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  await requireAdmin();
  const q = Number((await searchParams).jahr);
  const year = q >= 2020 && q <= 2100 ? q : new Date().getFullYear();
  const holidays = holidaysNiedersachsen(year);
  const days = await db.companyDay.findMany({
    where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
    orderBy: { date: "asc" },
  });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">Feiertage & Betriebstage {year}</h1>
        <div className="flex gap-2">
          <Link href={`/admin/kalender?jahr=${year - 1}`} className="btn btn-ghost min-h-12 px-4" aria-label="Vorjahr">◀</Link>
          <Link href={`/admin/kalender?jahr=${year + 1}`} className="btn btn-ghost min-h-12 px-4" aria-label="Folgejahr">▶</Link>
        </div>
      </div>
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Gesetzliche Feiertage Niedersachsen</h2>
        <p className="mb-2 text-sm">Werden automatisch berücksichtigt (Soll = 0).</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {holidays.map((h) => <li key={h.date}>{fmt(new Date(`${h.date}T12:00:00Z`), "EEE dd.MM.")} – {h.name}</li>)}
        </ul>
      </section>
      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Betriebstage</h2>
        {days.length === 0 ? <p>Keine Betriebstage eingetragen.</p> : (
          <ul className="divide-y divide-blau-100">
            {days.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span>{fmtDate(d.date)} – <b>{d.name}</b> ({KIND[d.kind]}{d.countsAsVacation ? ", als Urlaub verrechnet" : ""})</span>
                <form action={removeCompanyDay.bind(null, d.id)}><button className="text-sm font-semibold text-red-800 underline">entfernen</button></form>
              </li>
            ))}
          </ul>
        )}
        <form action={addChristmasHalfDays.bind(null, year)}>
          <button className="btn btn-ghost min-h-12 text-base">Heiligabend & Silvester {year} als halbe Tage eintragen</button>
        </form>
        <CompanyDayForm />
      </section>
    </div>
  );
}
