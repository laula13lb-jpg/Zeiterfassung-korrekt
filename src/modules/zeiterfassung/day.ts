import "server-only";
import { db } from "@/lib/db";
import { berlinDay } from "@/lib/time";
import { getSettings, summaryOptionsFor } from "@/modules/admin/settings";
import { allowedStamps, isStale, statusFromOpen, summarizeDay, type DaySummary, type StampType, type Status } from "./rules";

export interface DayView {
  status: Status;
  allowed: StampType[];
  /** Beginn des aktuellen Zustands (eingestempelt seit / Pause seit) */
  since: Date | null;
  /** Beginn der laufenden Schicht */
  shiftStart: Date | null;
  stale: boolean;
  workDate: Date;
  summary: DaySummary;
  entries: { id: string; kind: "ARBEIT" | "PAUSE"; start: Date; end: Date | null; origin: string; autoClosed: boolean }[];
}

/** Aktueller Status + heutiger Arbeitstag (bei Nachtschicht: Tag des Schichtbeginns) */
export async function getDayView(employeeId: string, now = new Date()): Promise<DayView> {
  const settings = await getSettings();
  const open = await db.timeEntry.findFirst({
    where: { employeeId, end: null, supersededById: null, voidedAt: null },
    orderBy: { start: "desc" },
  });
  const today = berlinDay(now);
  const stale = isStale(open, today);
  const workDate = today;
  const entries = await db.timeEntry.findMany({
    where: { employeeId, workDate, supersededById: null, voidedAt: null },
    orderBy: { start: "asc" },
    select: { id: true, kind: true, start: true, end: true, origin: true, autoClosed: true },
  });
  const summary = summarizeDay(entries, { now, ...summaryOptionsFor(settings, workDate) });
  const status = stale ? "ABWESEND" : statusFromOpen(open);
  const shiftEntries = entries.filter((e) => e.kind === "ARBEIT");
  // Schichtbeginn = Beginn des letzten zusammenhängenden Blocks (nach letztem „Gehen“)
  let shiftStart: Date | null = null;
  if (status !== "ABWESEND") {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      const prev = entries[i - 1];
      if (!prev || !prev.end || prev.end.getTime() !== e.start.getTime()) {
        shiftStart = e.start;
        break;
      }
    }
    shiftStart ??= shiftEntries[0]?.start ?? null;
  }
  return {
    status,
    allowed: allowedStamps(status),
    since: status !== "ABWESEND" && open ? open.start : null,
    shiftStart,
    stale,
    workDate,
    summary,
    entries,
  };
}
