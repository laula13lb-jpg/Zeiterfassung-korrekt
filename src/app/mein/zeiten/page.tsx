import { requireEmployee } from "@/modules/auth/guards";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { getMonthAccount } from "@/modules/zeiterfassung/account";
import { withdrawCorrection } from "@/modules/zeiterfassung/correction-actions";
import { MonthNav, MonthTable, parseMonth } from "@/components/MonthTable";

export const metadata = { title: "Meine Zeiten" };

const STATUS: Record<string, string> = { BEANTRAGT: "offen", GENEHMIGT: "genehmigt", ABGELEHNT: "abgelehnt", STORNIERT: "zurückgezogen" };

export default async function MeineZeiten({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const emp = await requireEmployee();
  const { year, month } = parseMonth((await searchParams).monat);
  const [acc, requests, changes] = await Promise.all([
    getMonthAccount(emp.id, year, month),
    db.correctionRequest.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({
      where: { subjectId: emp.id, entityType: { in: ["TimeDay", "BalanceAdjustment", "TimeEntry"] } },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { at: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Meine Zeiten</h1>
        <MonthNav year={year} month={month} base="/mein/zeiten" />
      </div>
      <MonthTable acc={acc} dayLink={(d) => `/mein/zeiten/korrektur?datum=${d}`} linkLabel="Korrektur" />

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Meine Korrekturanträge</h2>
        {requests.length === 0 ? <p>Keine Anträge.</p> : (
          <ul className="divide-y divide-blau-100">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-semibold">{fmtDate(r.workDate)}</span>
                <span className="flex-1">{r.message}</span>
                <span className="rounded-full bg-blau-100 px-3 py-0.5 text-sm font-bold">{STATUS[r.status] ?? r.status}</span>
                {r.decisionReason && <span className="w-full text-sm">Begründung: {r.decisionReason}</span>}
                {r.status === "BEANTRAGT" && (
                  <form action={withdrawCorrection.bind(null, r.id)}><button className="text-sm font-semibold underline">zurückziehen</button></form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Änderungen an meinen Zeiten</h2>
        {changes.length === 0 ? <p>Bisher keine Änderungen.</p> : (
          <ul className="divide-y divide-blau-100 text-base">
            {changes.map((c) => <ChangeItem key={c.id} c={c} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

type Block = { art: string; von: string; bis: string | null };
function ChangeItem({ c }: { c: { at: Date; action: string; reason: string | null; before: unknown; after: unknown; actor: { firstName: string; lastName: string } | null } }) {
  const b = c.before as { datum?: string; bloecke?: Block[] } | null;
  const a = c.after as { datum?: string; bloecke?: Block[]; minutes?: number } | null;
  const fmtBlocks = (x?: Block[]) => (x?.length ? x.map((y) => `${y.art === "PAUSE" ? "Pause " : ""}${y.von}–${y.bis ?? "…"}`).join(", ") : "keine");
  return (
    <li className="py-2">
      <div className="text-sm text-blau-800">{fmtDateTime(c.at)} · {c.actor ? `${c.actor.firstName} ${c.actor.lastName}` : "System"}</div>
      {a?.bloecke ? (
        <div>
          <b>{a.datum?.split("-").reverse().join(".")}</b>: vorher <span className="line-through">{fmtBlocks(b?.bloecke)}</span> → neu <b>{fmtBlocks(a.bloecke)}</b>
        </div>
      ) : (
        <div>{c.action === "balance.adjust" ? `Zeitkonto-Buchung ${a?.minutes && a.minutes > 0 ? "+" : ""}${Math.trunc((a?.minutes ?? 0) / 60)}:${String(Math.abs((a?.minutes ?? 0) % 60)).padStart(2, "0")} Std.` : c.action}</div>
      )}
      {c.reason && <div className="text-sm">Grund: {c.reason}</div>}
    </li>
  );
}
