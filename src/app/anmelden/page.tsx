import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Brand } from "@/components/Brand";
import { getSession } from "@/modules/auth/session";
import { EmployeeLogin } from "./EmployeeLogin";

export const metadata = { title: "Anmelden" };

export default async function AnmeldenPage() {
  if (await getSession("MITARBEITER")) redirect("/mein");
  const employees = await db.employee.findMany({
    where: { status: "AKTIV", pinHash: { not: null } },
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true, sortOrder: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const groups = new Map<string, { order: number; people: { id: string; name: string }[] }>();
  for (const e of employees) {
    const key = e.department?.name ?? "Ohne Abteilung";
    const g = groups.get(key) ?? { order: e.department?.sortOrder ?? 99, people: [] };
    g.people.push({ id: e.id, name: `${e.firstName} ${e.lastName}` });
    groups.set(key, g);
  }
  const grouped = [...groups.entries()].sort((a, b) => a[1].order - b[1].order).map(([name, g]) => ({ name, people: g.people }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between rounded-2xl bg-blau-800 p-4 text-white">
        <Brand subtitle="Anmelden" />
      </header>
      <EmployeeLogin groups={grouped} />
    </main>
  );
}
