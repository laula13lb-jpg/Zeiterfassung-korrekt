import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/modules/auth/guards";
import { openCorrectionRequests } from "@/modules/zeiterfassung/inbox";
import { decideCorrectionLead } from "@/modules/zeiterfassung/correction-actions";
import { decideAbsenceLead } from "@/modules/abwesenheit/absence-actions";
import { openAbsenceRequests } from "@/modules/abwesenheit/inbox";
import { calendarRows } from "@/modules/abwesenheit/absence-data";
import { CorrectionRequestList } from "@/components/CorrectionRequestList";
import { AbsenceInbox } from "@/components/AbsenceInbox";
import { AbsenceCalendar } from "@/components/AbsenceCalendar";
import { MonthNav, parseMonth } from "@/components/MonthTable";

export const metadata = { title: "Meine Abteilung" };

export default async function Abteilung({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const emp = await requireEmployee();
  if (!emp.roles.includes("ABTEILUNGSLEITER")) redirect("/mein");
  const { year, month } = parseMonth((await searchParams).monat);
  const me = await db.employee.findUniqueOrThrow({ where: { id: emp.id }, include: { ledDepartments: true } });
  const deptIds = me.ledDepartments.map((d) => d.id);
  const scope = { employee: { departmentId: { in: deptIds } }, employeeId: { not: emp.id } };
  const [corrections, absences, rows] = await Promise.all([
    openCorrectionRequests(scope),
    openAbsenceRequests(scope),
    calendarRows({ from: new Date(Date.UTC(year, month - 1, 1)), to: new Date(Date.UTC(year, month, 0)), departmentIds: deptIds, viewer: "lead", viewerId: emp.id, hideReasonForColleagues: false, includePending: true }),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Meine Abteilung</h1>
      <p>{me.ledDepartments.map((d) => d.name).join(", ")}</p>
      <h2 className="text-xl font-bold">Urlaubs- und Abwesenheitsanträge</h2>
      <div className="max-w-3xl"><AbsenceInbox items={absences} action={decideAbsenceLead} /></div>
      <h2 className="text-xl font-bold">Korrekturanträge</h2>
      <div className="max-w-3xl"><CorrectionRequestList requests={corrections} action={decideCorrectionLead} /></div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Abwesenheitskalender</h2>
        <MonthNav year={year} month={month} base="/mein/abteilung" />
      </div>
      <AbsenceCalendar rows={rows} year={year} month={month} />
      <p className="text-sm">Krankheit wird hier aus Datenschutzgründen nur als „abwesend“ angezeigt.</p>
    </div>
  );
}
