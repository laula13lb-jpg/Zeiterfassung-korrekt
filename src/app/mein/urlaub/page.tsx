import { db } from "@/lib/db";
import { berlinDay, fmtDate } from "@/lib/time";
import { requireEmployee } from "@/modules/auth/guards";
import { getSettings } from "@/modules/admin/settings";
import { requestAbsence } from "@/modules/abwesenheit/absence-actions";
import { calendarRows } from "@/modules/abwesenheit/absence-data";
import { vacationOverview } from "@/modules/abwesenheit/vacation";
import { AbsenceRequestForm } from "@/components/AbsenceRequestForm";
import { AbsenceCalendar } from "@/components/AbsenceCalendar";
import { MonthNav, parseMonth } from "@/components/MonthTable";
import { OwnAbsenceList } from "@/components/OwnAbsenceList";
import { VacationSummary } from "@/components/VacationSummary";

export const metadata = { title: "Urlaub" };

export default async function Urlaub({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const emp = await requireEmployee();
  const { year, month } = parseMonth((await searchParams).monat);
  const settings = await getSettings();
  const thisYear = berlinDay().getUTCFullYear();
  const [ov, types, requests, rows] = await Promise.all([
    vacationOverview(emp.id, thisYear),
    db.absenceType.findMany({ where: { active: true }, orderBy: [{ system: "desc" }, { name: "asc" }] }),
    db.absenceRequest.findMany({ where: { employeeId: emp.id }, include: { type: true }, orderBy: { startDate: "desc" }, take: 30 }),
    emp.departmentId
      ? calendarRows({
          from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)),
          departmentIds: [emp.departmentId], viewer: "colleague", viewerId: emp.id,
          hideReasonForColleagues: settings.hideAbsenceReasonForColleagues, includePending: false,
        })
      : Promise.resolve([]),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Urlaub & Abwesenheit</h1>
      <VacationSummary ov={ov} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Neuer Antrag</h2>
        <AbsenceRequestForm types={types.map((t) => ({ id: t.id, name: t.name, code: t.code, requiresApproval: t.requiresApproval }))} action={requestAbsence} />
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Meine Anträge</h2>
        <OwnAbsenceList items={requests.map((r) => ({
          id: r.id, type: r.type.name, days: Number(r.days), status: r.status, comment: r.comment, decisionReason: r.decisionReason,
          range: r.startDate.getTime() === r.endDate.getTime() ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`,
        }))} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Abwesenheiten in meiner Abteilung</h2>
          <MonthNav year={year} month={month} base="/mein/urlaub" />
        </div>
        <AbsenceCalendar rows={rows} year={year} month={month} />
        {settings.hideAbsenceReasonForColleagues && <p className="text-sm">Bei Kollegen wird nur „abwesend“ angezeigt.</p>}
      </section>
    </div>
  );
}
