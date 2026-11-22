import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/guards";
import { getSettings } from "@/modules/admin/settings";
import { currentBalance } from "@/modules/zeiterfassung/account";
import { balanceLight } from "@/modules/zeiterfassung/account-rules";
import { BalanceLight } from "@/components/BalanceLight";

export const metadata = { title: "Mitarbeiter" };

export default async function Mitarbeiter({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  await requireAdmin();
  const showAll = (await searchParams).alle === "1";
  const settings = await getSettings();
  const emps = await db.employee.findMany({
    where: showAll ? {} : { status: { not: "AUSGETRETEN" } },
    include: { department: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const balances = await Promise.all(emps.map((e) => (e.tracksTime ? currentBalance(e.id) : Promise.resolve(null))));
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Mitarbeiter</h1>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/mitarbeiter/neu" className="btn btn-accent">+ Mitarbeiter anlegen</Link>
        <Link href={showAll ? "/admin/mitarbeiter" : "/admin/mitarbeiter?alle=1"} className="font-semibold underline">{showAll ? "nur aktive zeigen" : "auch ausgetretene zeigen"}</Link>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[36rem] text-left">
          <thead className="bg-blau-800 text-sm text-white">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Pers.-Nr.</th><th className="px-3 py-2">Abteilung</th><th className="px-3 py-2">Zeitkonto</th><th /></tr>
          </thead>
          <tbody>
            {emps.map((e, i) => (
              <tr key={e.id} className="border-b border-blau-100">
                <td className="px-3 py-2 font-semibold">{e.lastName}, {e.firstName}{e.status !== "AKTIV" && <span className="ml-2 rounded bg-red-100 px-2 text-xs text-red-800">{e.status === "GESPERRT" ? "gesperrt" : "ausgetreten"}</span>}</td>
                <td className="px-3 py-2">{e.personnelNo}</td>
                <td className="px-3 py-2">{e.department?.name ?? "–"}</td>
                <td className="px-3 py-2">{balances[i] === null ? "–" : <BalanceLight minutes={balances[i]!} light={balanceLight(balances[i]!, settings.balanceYellowHours, settings.balanceRedHours)} />}</td>
                <td className="px-3 py-2 text-right"><Link href={`/admin/mitarbeiter/${e.id}`} className="font-semibold text-blau-700 underline">Details</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
