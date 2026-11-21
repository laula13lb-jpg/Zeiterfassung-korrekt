import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/guards";
import { getMonthAccount } from "@/modules/zeiterfassung/account";
import { MonthNav, MonthTable, parseMonth } from "@/components/MonthTable";
import { AdjustmentForm } from "./AdjustmentForm";

export const metadata = { title: "Zeiten" };

export default async function AdminZeiten({ searchParams }: { searchParams: Promise<{ monat?: string; mitarbeiter?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.monat);
  const employees = await db.employee.findMany({
    where: { tracksTime: true, status: { not: "AUSGETRETEN" } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, personnelNo: true },
  });
  const selected = employees.find((e) => e.id === sp.mitarbeiter) ?? null;
  const acc = selected ? await getMonthAccount(selected.id, year, month) : null;
  const monat = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Zeiten</h1>
      <form className="card flex flex-wrap items-end gap-3" method="get">
        <label className="flex-1"><span className="mb-1 block font-semibold">Mitarbeiter</span>
          <select name="mitarbeiter" defaultValue={selected?.id ?? ""} className="field">
            <option value="">– bitte wählen –</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.lastName}, {e.firstName} ({e.personnelNo})</option>)}
          </select>
        </label>
        <input type="hidden" name="monat" value={monat} />
        <button className="btn btn-primary">Anzeigen</button>
      </form>
      {selected && acc && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">{selected.firstName} {selected.lastName}</h2>
            <MonthNav year={year} month={month} base={`/admin/zeiten?mitarbeiter=${selected.id}`} />
          </div>
          <MonthTable acc={acc} dayLink={(d) => `/admin/zeiten/${selected.id}/${d}`} />
          <AdjustmentForm employeeId={selected.id} />
        </>
      )}
    </div>
  );
}
