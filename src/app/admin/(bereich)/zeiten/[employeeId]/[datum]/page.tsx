import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fmt, fmtDateTime, fmtTime } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { currentBlocks } from "@/modules/zeiterfassung/corrections";
import { DayEditor } from "./DayEditor";

export const metadata = { title: "Tag korrigieren" };
const TYPE: Record<string, string> = { KOMMEN: "Kommen", PAUSE_START: "Pause", PAUSE_ENDE: "Pause Ende", GEHEN: "Gehen" };

export default async function DayPage({ params }: { params: Promise<{ employeeId: string; datum: string }> }) {
  await requireAdmin();
  const { employeeId, datum } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) notFound();
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  if (!emp) notFound();
  const day = new Date(`${datum}T00:00:00Z`);
  const next = new Date(day.getTime() + 86_400_000);
  const [blocks, events, history] = await Promise.all([
    currentBlocks(employeeId, day),
    db.stampEvent.findMany({ where: { employeeId, at: { gte: new Date(day.getTime() - 3 * 3600_000), lt: new Date(next.getTime() + 3 * 3600_000) } }, orderBy: { at: "asc" } }),
    db.auditLog.findMany({
      where: { subjectId: employeeId, entityType: "TimeDay", after: { path: ["datum"], equals: datum } },
      include: { actor: { select: { firstName: true, lastName: true } } },
      orderBy: { at: "desc" },
    }),
  ]);
  const dayEvents = events.filter((e) => fmt(e.at, "yyyy-MM-dd") === datum);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href={`/admin/zeiten?mitarbeiter=${employeeId}&monat=${datum.slice(0, 7)}`} className="font-semibold underline">← zurück zur Monatsübersicht</Link>
      <h1 className="text-3xl font-extrabold">{emp.firstName} {emp.lastName}</h1>
      <p className="text-lg">{fmt(new Date(`${datum}T12:00:00Z`), "EEEE, d. MMMM yyyy")}</p>
      <DayEditor employeeId={employeeId} datum={datum} initial={blocks} />
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Original-Stempelungen</h2>
        {dayEvents.length === 0 ? <p>Keine.</p> : (
          <ul className="text-base">
            {dayEvents.map((e) => (
              <li key={e.id}>{fmtTime(e.at)} – {TYPE[e.type]} ({e.source === "TERMINAL" ? "Terminal" : e.source === "PERSOENLICH" ? "Handy/PC" : "Admin"}{e.offline ? ", offline erfasst" : ""})</li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="mb-2 text-xl font-bold">Änderungsprotokoll dieses Tages</h2>
        {history.length === 0 ? <p>Keine Änderungen.</p> : (
          <ul className="divide-y divide-blau-100 text-base">
            {history.map((h) => {
              const f = (x: unknown) => ((x as { bloecke?: { art: string; von: string; bis: string | null }[] })?.bloecke ?? [])
                .map((b) => `${b.art === "PAUSE" ? "Pause " : ""}${b.von}–${b.bis ?? "…"}`).join(", ") || "keine";
              return (
                <li key={h.id} className="py-2" data-testid="audit-eintrag">
                  <div className="text-sm text-blau-800">{fmtDateTime(h.at)} · {h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : "System"}</div>
                  <div>vorher: <span className="line-through">{f(h.before)}</span></div>
                  <div>neu: <b>{f(h.after)}</b></div>
                  <div className="text-sm">Grund: {h.reason}</div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
