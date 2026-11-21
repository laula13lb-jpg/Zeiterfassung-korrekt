import { db } from "@/lib/db";
import { currentTerminal } from "@/modules/zeiterfassung/terminal-device";
import { ActivateTerminal } from "./ActivateTerminal";
import { TerminalApp } from "./TerminalApp";

export const metadata = { title: "Terminal" };

export default async function TerminalPage() {
  const terminal = await currentTerminal();
  if (!terminal) return <ActivateTerminal />;

  const employees = await db.employee.findMany({
    where: { status: "AKTIV", tracksTime: true, pinHash: { not: null } },
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
  return <TerminalApp groups={grouped} serverNow={Date.now()} terminalName={terminal.name} />;
}
