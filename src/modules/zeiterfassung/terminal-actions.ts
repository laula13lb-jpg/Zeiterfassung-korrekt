"use server";

import { db } from "@/lib/db";
import { clientIp } from "@/lib/request";
import { isRateLimited, LIMITS, registerFailure } from "@/lib/rate-limit";
import { signToken, verifyToken } from "@/lib/signed";
import { fmtTime, inBerlin } from "@/lib/time";
import { checkPin } from "@/modules/auth/pin-check";
import { getDayView } from "./day";
import { greeting, type StampType, type Status } from "./rules";
import { performStamp } from "./stamp";
import { activateWithCode, currentTerminal } from "./terminal-device";

export type TerminalPerson = {
  token: string;
  firstName: string;
  status: Status;
  allowed: StampType[];
  since: string | null;
  workMinutes: number;
  breakMinutes: number;
  deductedMinutes: number;
  staleNotice: string | null;
};

export async function activateTerminal(_prev: { error?: string } | undefined, fd: FormData): Promise<{ error?: string } | undefined> {
  const ip = await clientIp();
  const key = `term:${ip}`;
  if (isRateLimited(key, LIMITS.adminPerIp.max, LIMITS.adminPerIp.windowMs)) return { error: "Zu viele Versuche. Bitte später erneut." };
  const t = await activateWithCode(String(fd.get("code") ?? ""));
  if (!t) {
    registerFailure(key, LIMITS.adminPerIp.windowMs);
    return { error: "Code ungültig oder abgelaufen. Bitte im Admin-Bereich unter „Terminals“ einen neuen Code erzeugen." };
  }
  return undefined;
}

/** Schritt 1 am Terminal: PIN prüfen → Status + kurzlebiges Aktions-Token */
export async function terminalVerifyPin(employeeId: string, pin: string): Promise<{ ok: true; person: TerminalPerson } | { ok: false; error: string }> {
  const terminal = await currentTerminal();
  if (!terminal) return { ok: false, error: "Dieses Gerät ist nicht als Terminal freigeschaltet." };
  const emp = await db.employee.findUnique({ where: { id: employeeId } });
  const res = await checkPin(emp, pin, { ip: await clientIp(), kind: "TERMINAL_PIN", identifier: employeeId });
  if (!res.ok) return res;
  if (!res.employee.tracksTime) return { ok: false, error: "Für dich ist keine Zeiterfassung aktiv." };
  const day = await getDayView(res.employee.id);
  return {
    ok: true,
    person: {
      token: signToken({ e: res.employee.id, t: terminal.id }, 120),
      firstName: res.employee.firstName,
      status: day.status,
      allowed: day.allowed,
      since: day.since ? fmtTime(day.since) : null,
      workMinutes: day.summary.netWorkMinutes,
      breakMinutes: day.summary.breakMinutes,
      deductedMinutes: day.summary.deductedMinutes,
      staleNotice: day.stale ? "Du hast an einem früheren Tag nicht ausgestempelt. Bitte im Büro melden oder Korrekturantrag stellen." : null,
    },
  };
}

/** Schritt 2 am Terminal: Stempelung mit Aktions-Token */
export async function terminalStamp(token: string, type: StampType, clientId: string): Promise<{ ok: true; message: string; notice?: string } | { ok: false; error: string }> {
  const terminal = await currentTerminal();
  if (!terminal) return { ok: false, error: "Dieses Gerät ist nicht als Terminal freigeschaltet." };
  const data = verifyToken<{ e: string; t: string }>(token);
  if (!data || data.t !== terminal.id) return { ok: false, error: "Zeit abgelaufen. Bitte noch einmal anmelden." };
  const res = await performStamp({ employeeId: data.e, type, source: "TERMINAL", terminalId: terminal.id, clientId, ip: await clientIp() });
  if (!res.ok) return res;
  const emp = await db.employee.findUniqueOrThrow({ where: { id: data.e }, select: { firstName: true } });
  const verb: Record<StampType, string> = { KOMMEN: "eingestempelt", PAUSE_START: "Pause ab", PAUSE_ENDE: "Pause beendet", GEHEN: "ausgestempelt" };
  return {
    ok: true,
    message: `${greeting(type, inBerlin(res.at).getHours())}, ${emp.firstName} – ${verb[type]} ${fmtTime(res.at)}`,
    notice: res.autoClosedNotice,
  };
}

/**
 * Nachsynchronisation einer offline erfassten Stempelung (Original-Zeitstempel).
 * Rückgabe "retry" = später erneut versuchen; "drop" = endgültig (Erfolg oder dauerhafter Fehler).
 */
export async function terminalOfflineSync(item: {
  clientId: string;
  employeeId: string;
  pin: string;
  type: StampType;
  at: number;
}): Promise<{ result: "ok" | "drop"; message?: string }> {
  const terminal = await currentTerminal();
  if (!terminal) return { result: "drop", message: "Terminal nicht freigeschaltet" };
  const ip = await clientIp();
  const already = await db.stampEvent.findUnique({ where: { clientId: item.clientId } });
  if (already) return { result: "ok" };
  const emp = await db.employee.findUnique({ where: { id: item.employeeId } });
  const check = await checkPin(emp, item.pin, { ip, kind: "TERMINAL_PIN", identifier: item.employeeId });
  let error: string | null = null;
  if (!check.ok) error = check.error;
  else {
    const r = await performStamp({
      employeeId: item.employeeId, type: item.type, at: new Date(item.at), offline: true,
      source: "TERMINAL", terminalId: terminal.id, clientId: item.clientId, ip,
    });
    if (!r.ok) error = r.error;
  }
  if (error) {
    // dauerhaft fehlgeschlagen → Verwaltung informieren, damit die Zeit korrigiert werden kann
    const admins = await db.employee.findMany({ where: { status: "AKTIV", roles: { has: "ADMIN" } }, select: { id: true } });
    const who = emp ? `${emp.firstName} ${emp.lastName}` : "Unbekannt";
    await db.notification.createMany({
      data: admins.map((a) => ({
        employeeId: a.id,
        title: `Offline-Stempelung nicht übernommen: ${who}, ${new Date(item.at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
        body: error,
        link: "/admin/zeiten",
      })),
    });
    return { result: "drop", message: error };
  }
  return { result: "ok" };
}
