import "server-only";
import type { WarningType } from "@prisma/client";
import { db } from "@/lib/db";
import { berlinDay, berlinTimeOn, fmtTime, fmtMinutes } from "@/lib/time";
import { getSettings } from "@/modules/admin/settings";
import { addDays } from "./account-rules";
import { summarizeDay } from "./rules";

/**
 * Hinweise nach Arbeitszeitgesetz für einen Tag neu bewerten.
 * Geprüft wird die TATSÄCHLICHE Arbeitszeit (ohne Anrechnungsgrenze 6:00, gesetzliche Pausenregel).
 * Nicht mehr zutreffende, unerledigte Hinweise werden entfernt.
 */
export async function evaluateDayWarnings(employeeId: string, workDate: Date) {
  const entries = await db.timeEntry.findMany({ where: { employeeId, workDate, voidedAt: null } });
  const found = new Map<WarningType, string>();
  if (entries.length) {
    const s = summarizeDay(entries, { mode: "hinweis" });
    if (!s.open) {
      if (s.workMinutes > 600) found.set("UEBER_10_STUNDEN", `Arbeitszeit ${fmtMinutes(s.workMinutes)}`);
      if (s.missingBreakMinutes > 0) found.set("PAUSE_FEHLT", `Es fehlen ${s.missingBreakMinutes} Min. Pause (gesetzlich ${s.requiredBreakMinutes} Min. bei ${fmtMinutes(s.workMinutes)})`);
    }
    // Ruhezeit: Ende des Vortags → Beginn heute
    const prev = await db.timeEntry.findFirst({
      where: { employeeId, workDate: addDays(workDate, -1), voidedAt: null, kind: "ARBEIT", end: { not: null } },
      orderBy: { end: "desc" },
    });
    if (prev?.end && s.firstStart) {
      const rest = (s.firstStart.getTime() - prev.end.getTime()) / 60_000;
      if (rest < 11 * 60) found.set("RUHEZEIT_UNTER_11", `Ruhezeit ${fmtMinutes(Math.max(0, Math.floor(rest)))} (Ende Vortag ${fmtTime(prev.end)}, Beginn ${fmtTime(s.firstStart)})`);
    }
    if (entries.some((e) => e.autoClosed)) found.set("NICHT_AUSGESTEMPELT", "Nicht ausgestempelt – Buchung mit 0 Std. geschlossen");
  }
  const checked: WarningType[] = ["UEBER_10_STUNDEN", "PAUSE_FEHLT", "RUHEZEIT_UNTER_11", "NICHT_AUSGESTEMPELT"];
  for (const type of checked) {
    const details = found.get(type);
    if (details) {
      await db.timeWarning.upsert({
        where: { employeeId_workDate_type: { employeeId, workDate, type } },
        create: { employeeId, workDate, type, details },
        update: { details },
      });
    } else if (type !== "NICHT_AUSGESTEMPELT" || !entries.some((e) => e.end === null)) {
      await db.timeWarning.deleteMany({ where: { employeeId, workDate, type, resolvedAt: null } });
    }
  }
}

/** Offene Buchungen nach der eingestellten Uhrzeit (Standard 22:00) bzw. vom Vortag → Hinweis „nicht ausgestempelt“ */
export async function checkOpenEntries(now = new Date()) {
  const settings = await getSettings();
  const today = berlinDay(now);
  const open = await db.timeEntry.findMany({ where: { end: null, voidedAt: null } });
  for (const e of open) {
    const late = e.workDate < today || now >= berlinTimeOn(e.workDate, settings.forgotClockOutTime);
    if (!late) continue;
    await db.timeWarning.upsert({
      where: { employeeId_workDate_type: { employeeId: e.employeeId, workDate: e.workDate, type: "NICHT_AUSGESTEMPELT" } },
      create: { employeeId: e.employeeId, workDate: e.workDate, type: "NICHT_AUSGESTEMPELT", details: `Noch eingestempelt seit ${fmtTime(e.start)}` },
      update: {},
    });
  }
}

export const WARNING_LABEL: Record<WarningType, string> = {
  PAUSE_FEHLT: "Pause fehlt",
  UEBER_10_STUNDEN: "Mehr als 10 Std.",
  RUHEZEIT_UNTER_11: "Ruhezeit unter 11 Std.",
  NICHT_AUSGESTEMPELT: "Nicht ausgestempelt",
};

/** Austritte mit Datum in der Vergangenheit umsetzen (Zugang sperren, Daten bleiben erhalten) */
export async function applyExits(now = new Date()) {
  const today = berlinDay(now);
  const due = await db.employee.findMany({ where: { status: { not: "AUSGETRETEN" }, exitDate: { lt: today } }, select: { id: true } });
  for (const e of due) {
    await db.employee.update({ where: { id: e.id }, data: { status: "AUSGETRETEN" } });
    await db.session.deleteMany({ where: { employeeId: e.id } });
  }
}
