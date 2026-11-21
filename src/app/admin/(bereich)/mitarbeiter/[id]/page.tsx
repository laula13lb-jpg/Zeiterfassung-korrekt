import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dayKey, fmtDate } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { fmtHm } from "@/modules/zeiterfassung/blocks";
import { ScheduleForm, AccountStartForm } from "./ScheduleForm";

export const metadata = { title: "Mitarbeiter" };
const DAYS = [["mon", "Mo"], ["tue", "Di"], ["wed", "Mi"], ["thu", "Do"], ["fri", "Fr"], ["sat", "Sa"], ["sun", "So"]] as const;

export default async function MitarbeiterDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const emp = await db.employee.findUnique({ where: { id }, include: { department: true, schedules: { orderBy: { validFrom: "desc" } } } });
  if (!emp) notFound();
  const latest = emp.schedules[0];
  const defaults = Object.fromEntries(DAYS.map(([k]) => [k, fmtHm(latest ? (latest[`${k}Minutes` as keyof typeof latest] as number) : k === "fri" ? 420 : ["sat", "sun"].includes(k) ? 0 : 480)]));
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/admin/mitarbeiter" className="font-semibold underline">← Mitarbeiterliste</Link>
      <h1 className="text-3xl font-extrabold">{emp.firstName} {emp.lastName}</h1>
      <p>Pers.-Nr. {emp.personnelNo} · {emp.department?.name ?? "ohne Abteilung"} · Eintritt {fmtDate(emp.entryDate)}</p>
      <Link href={`/admin/zeiten?mitarbeiter=${emp.id}`} className="btn btn-ghost self-start">Zeiten & Zeitkonto ansehen</Link>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Arbeitszeitmodell</h2>
        {emp.schedules.length === 0 ? <p>Noch kein Modell hinterlegt.</p> : (
          <table className="w-full text-left text-base">
            <thead><tr><th>gültig ab</th>{DAYS.map(([, l]) => <th key={l} className="text-right">{l}</th>)}<th className="text-right">Woche</th></tr></thead>
            <tbody>
              {emp.schedules.map((s) => {
                const mins = DAYS.map(([k]) => s[`${k}Minutes` as keyof typeof s] as number);
                return (
                  <tr key={s.id} className="border-t border-blau-100">
                    <td>{fmtDate(s.validFrom)}</td>
                    {mins.map((m, i) => <td key={i} className="text-right tabular-nums">{m ? fmtHm(m) : "–"}</td>)}
                    <td className="text-right font-bold tabular-nums">{fmtHm(mins.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <ScheduleForm employeeId={emp.id} defaults={defaults} />
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-xl font-bold">Zeitkonto-Beginn</h2>
        <p className="text-sm">Ab diesem Tag wird Soll/Ist gerechnet (z. B. Einführung der App). Einen vorhandenen Überstundenstand buchen Sie unter „Zeiten“ als „Übertrag“.</p>
        <AccountStartForm employeeId={emp.id} value={dayKey(emp.timeAccountStart ?? emp.entryDate)} />
      </section>
    </div>
  );
}
