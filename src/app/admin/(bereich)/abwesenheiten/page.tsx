import Link from "next/link";
import { db } from "@/lib/db";
import { berlinDay, fmtDate } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { adminCreateAbsence } from "@/modules/abwesenheit/absence-actions";
import { calendarRows } from "@/modules/abwesenheit/absence-data";
import { vacationOverview, ACTIVE_STATUSES } from "@/modules/abwesenheit/vacation";
import { AbsenceCalendar, CalendarLegend } from "@/components/AbsenceCalendar";
import { AbsenceRequestForm } from "@/components/AbsenceRequestForm";
import { MonthNav, parseMonth } from "@/components/MonthTable";
import { AdminCancelAbsence } from "./AdminCancelAbsence";

export const metadata = { title: "Abwesenheiten" };
const n = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export default async function Abwesenheiten({ searchParams }: { searchParams: Promise<{ monat?: string; ansicht?: string; jahr?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.ansicht === "jahr" ? "jahr" : "monat";
  const { year, month } = parseMonth(sp.monat);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0));
  const types = await db.absenceType.findMany({ where: { active: true }, orderBy: [{ system: "desc" }, { name: "asc" }] });
  const employees = await db.employee.findMany({ where: { status: "AKTIV", tracksTime: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], include: { department: true } });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Abwesenheiten</h1>
      <div className="flex gap-2">
        <Link href="/admin/abwesenheiten" aria-current={view === "monat" ? "page" : undefined} className={`btn min-h-12 ${view === "monat" ? "btn-primary" : "btn-ghost"}`}>Monat</Link>
        <Link href="/admin/abwesenheiten?ansicht=jahr" aria-current={view === "jahr" ? "page" : undefined} className={`btn min-h-12 ${view === "jahr" ? "btn-primary" : "btn-ghost"}`}>Jahr / Resturlaub</Link>
      </div>
      {view === "monat" ? <MonthView year={year} month={month} from={from} to={to} types={types} /> : <YearView year={Number(sp.jahr) || berlinDay().getUTCFullYear()} employees={employees} />}
      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-xl font-bold">Abwesenheit direkt eintragen</h2>
        <p className="text-sm">Wird sofort als genehmigt gespeichert (z. B. Urlaub, der telefonisch abgesprochen wurde). Krankmeldungen folgen in Meilenstein 5.</p>
        <AbsenceRequestForm types={types} action={adminCreateAbsence} employees={employees.map((e) => ({ id: e.id, name: `${e.lastName}, ${e.firstName}` }))} submitLabel="Eintragen" />
      </section>
    </div>
  );
}

async function MonthView({ year, month, from, to, types }: { year: number; month: number; from: Date; to: Date; types: { name: string; color: string }[] }) {
  const [rows, list] = await Promise.all([
    calendarRows({ from, to, viewer: "admin", hideReasonForColleagues: false, includePending: true }),
    db.absenceRequest.findMany({
      where: { status: { in: [...ACTIVE_STATUSES] }, startDate: { lte: to }, endDate: { gte: from } },
      include: { type: true, employee: true },
      orderBy: { startDate: "asc" },
    }),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CalendarLegend items={[...types, { name: "Krank", color: "#b91c1c" }]} />
        <MonthNav year={year} month={month} base="/admin/abwesenheiten" />
      </div>
      <AbsenceCalendar rows={rows} year={year} month={month} />
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Einträge in diesem Monat</h2>
        {list.length === 0 ? <p>Keine.</p> : (
          <ul className="divide-y divide-blau-100">
            {list.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                <b>{a.employee.firstName} {a.employee.lastName}</b>
                <span>{a.type.name}</span>
                <span>{fmtDate(a.startDate)}{a.endDate.getTime() !== a.startDate.getTime() ? ` – ${fmtDate(a.endDate)}` : ""}</span>
                <span className="text-sm">({n(Number(a.days))} Tage{a.status !== "GENEHMIGT" ? `, ${a.status === "BEANTRAGT" ? "beantragt" : "Storno beantragt"}` : ""})</span>
                <span className="ml-auto"><AdminCancelAbsence id={a.id} /></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

async function YearView({ year, employees }: { year: number; employees: { id: string; firstName: string; lastName: string; department: { name: string } | null }[] }) {
  const data = await Promise.all(employees.map(async (e) => ({ e, ov: await vacationOverview(e.id, year) })));
  return (
    <>
      <div className="flex items-center gap-2">
        <Link href={`/admin/abwesenheiten?ansicht=jahr&jahr=${year - 1}`} className="btn btn-ghost min-h-12 px-4" aria-label="Vorjahr">◀</Link>
        <span className="text-xl font-bold">{year}</span>
        <Link href={`/admin/abwesenheiten?ansicht=jahr&jahr=${year + 1}`} className="btn btn-ghost min-h-12 px-4" aria-label="Folgejahr">▶</Link>
      </div>
      <div className="card min-w-0 max-w-full overflow-x-auto p-0">
        <table className="w-full min-w-[40rem] text-left">
          <thead className="bg-blau-800 text-sm text-white">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Abteilung</th><th className="px-3 py-2 text-right">Anspruch</th><th className="px-3 py-2 text-right">Übertrag</th><th className="px-3 py-2 text-right">genehmigt</th><th className="px-3 py-2 text-right">beantragt</th><th className="px-3 py-2 text-right">verfallen</th><th className="px-3 py-2 text-right">Rest</th></tr>
          </thead>
          <tbody>
            {data.map(({ e, ov }) => (
              <tr key={e.id} className="border-b border-blau-100">
                <td className="px-3 py-2 font-semibold"><Link href={`/admin/mitarbeiter/${e.id}`} className="underline">{e.lastName}, {e.firstName}</Link></td>
                <td className="px-3 py-2">{e.department?.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(ov.balance.entitlement)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(ov.balance.carryIn)}{ov.balance.carryRemaining > 0 ? " ⚠" : ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(ov.balance.taken)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(ov.pending)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{n(ov.balance.expired)}</td>
                <td className={`px-3 py-2 text-right font-bold tabular-nums ${ov.balance.remaining < 0 ? "text-red-700" : ""}`}>{n(ov.balance.remaining)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm">⚠ = Übertrag aus dem Vorjahr, der bis zum Verfallsdatum noch genommen werden muss. Anspruch und Übertrag pro Person ändern Sie unter „Mitarbeiter → Details“.</p>
    </>
  );
}
