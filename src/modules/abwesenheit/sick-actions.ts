"use server";

import { revalidatePath } from "next/cache";
import type { Employee, SickLeave } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { berlinDay, fmtDate } from "@/lib/time";
import { requireAdmin, requireEmployee } from "@/modules/auth/guards";
import { assertMonthOpen, CorrectionError } from "@/modules/zeiterfassung/corrections";
import { addDays } from "@/modules/zeiterfassung/account-rules";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const parseDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const range = (s: Pick<SickLeave, "startDate" | "endDate">) => `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`;
/** Protokoll ohne Gesundheitsdetails – nur Zeitraum und Status */
const snapshot = (s: Pick<SickLeave, "startDate" | "endDate" | "auPresent" | "eauRetrieved" | "childSick">) => ({
  von: s.startDate, bis: s.endDate, au: s.auPresent, eau: s.eauRetrieved, kindKrank: s.childSick,
});

async function monthsOpen(employeeId: string, start: Date, end: Date) {
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    await assertMonthOpen(employeeId, d);
  }
}

function validateRange(start: Date | null, end: Date | null, opts: { maxPastDays: number }): string | null {
  if (!start) return "Bitte Beginn angeben.";
  if (!end) return "Bitte voraussichtliches Ende angeben.";
  if (end < start) return "Das Ende darf nicht vor dem Beginn liegen.";
  if (start < addDays(berlinDay(), -opts.maxPastDays)) return "Der Beginn liegt zu weit zurück – bitte im Büro melden.";
  if (start > addDays(berlinDay(), 7)) return "Krankmeldungen bitte erst ab Beginn der Arbeitsunfähigkeit erfassen.";
  if (end.getTime() - start.getTime() > 183 * 86_400_000) return "Höchstens 6 Monate auf einmal – danach verlängern.";
  return null;
}

async function overlapping(employeeId: string, start: Date, end: Date, exceptId?: string) {
  return db.sickLeave.findFirst({ where: { employeeId, cancelledAt: null, startDate: { lte: end }, endDate: { gte: start }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
}

/** Admins (mit Zeitraum) und Abteilungsleiter (nur „abwesend“) informieren */
async function notifyAboutSick(emp: Employee, s: SickLeave, verb: string) {
  const admins = await db.employee.findMany({ where: { status: "AKTIV", roles: { has: "ADMIN" }, id: { not: emp.id } }, select: { id: true } });
  const leads = emp.departmentId
    ? await db.employee.findMany({ where: { status: "AKTIV", roles: { has: "ABTEILUNGSLEITER" }, ledDepartments: { some: { id: emp.departmentId } }, id: { not: emp.id } }, select: { id: true } })
    : [];
  const adminIds = new Set(admins.map((a) => a.id));
  await db.notification.createMany({
    data: [
      ...admins.map((a) => ({ employeeId: a.id, title: `${verb}: ${emp.firstName} ${emp.lastName}, ${range(s)}${s.childSick ? " (Kind krank)" : ""}`, link: "/admin/krankheit" })),
      // Datenschutz: Abteilungsleiter erfahren nur, dass jemand abwesend ist
      ...leads.filter((l) => !adminIds.has(l.id)).map((l) => ({ employeeId: l.id, title: `${emp.firstName} ${emp.lastName} ist abwesend: ${range(s)}`, link: "/mein/abteilung" })),
    ],
  });
}

// ───────────── Mitarbeiter ─────────────

export async function reportSick(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const start = parseDay(str(fd, "start"));
  const end = parseDay(str(fd, "end"));
  const err = validateRange(start, end, { maxPastDays: 14 });
  if (err) return { error: err };
  if (await overlapping(emp.id, start!, end!)) return { error: "Für diesen Zeitraum gibt es schon eine Krankmeldung – bitte dort verlängern." };
  try {
    await monthsOpen(emp.id, start!, end!);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  const s = await db.sickLeave.create({
    data: { employeeId: emp.id, startDate: start!, endDate: end!, childSick: fd.get("childSick") === "on", auPresent: fd.get("auPresent") === "on", createdById: emp.id },
  });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "sick.report", entityType: "SickLeave", entityId: s.id, after: snapshot(s), ip: await clientIp() });
  await notifyAboutSick(emp, s, "Krankmeldung");
  revalidatePath("/mein/krank");
  return { ok: "Krankmeldung gespeichert. Gute Besserung!" };
}

export async function extendSick(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const s = await db.sickLeave.findUnique({ where: { id: str(fd, "id") } });
  if (!s || s.employeeId !== emp.id || s.cancelledAt) return { error: "Nicht gefunden." };
  const end = parseDay(str(fd, "end"));
  if (!end || end <= s.endDate) return { error: "Das neue Ende muss nach dem bisherigen liegen." };
  if (end.getTime() - s.startDate.getTime() > 366 * 86_400_000) return { error: "Zu lang – bitte im Büro melden." };
  if (await overlapping(emp.id, s.startDate, end, s.id)) return { error: "Überschneidet sich mit einer anderen Krankmeldung." };
  const after = await db.sickLeave.update({ where: { id: s.id }, data: { endDate: end, auPresent: s.auPresent || fd.get("auPresent") === "on" } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "sick.extend", entityType: "SickLeave", entityId: s.id, before: snapshot(s), after: snapshot(after), ip: await clientIp() });
  await notifyAboutSick(emp, after, "Krankmeldung verlängert");
  revalidatePath("/mein/krank");
  return { ok: `Verlängert bis ${fmtDate(end)}.` };
}

// ───────────── Admin ─────────────

export async function adminSaveSick(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  const start = parseDay(str(fd, "start"));
  const end = parseDay(str(fd, "end"));
  const err = validateRange(start, end, { maxPastDays: 400 });
  if (err) return { error: err };
  const flags = { auPresent: fd.get("auPresent") === "on", eauRetrieved: fd.get("eauRetrieved") === "on", childSick: fd.get("childSick") === "on" };
  const ip = await clientIp();
  try {
    if (id) {
      const before = await db.sickLeave.findUniqueOrThrow({ where: { id } });
      if (await overlapping(before.employeeId, start!, end!, id)) return { error: "Überschneidet sich mit einer anderen Krankmeldung." };
      await monthsOpen(before.employeeId, start! < before.startDate ? start! : before.startDate, end! > before.endDate ? end! : before.endDate);
      const after = await db.sickLeave.update({ where: { id }, data: { startDate: start!, endDate: end!, ...flags } });
      await audit({ actorId: admin.id, subjectId: before.employeeId, action: "sick.update", entityType: "SickLeave", entityId: id, before: snapshot(before), after: snapshot(after), ip });
    } else {
      const employeeId = str(fd, "employeeId");
      const emp = await db.employee.findUnique({ where: { id: employeeId } });
      if (!emp) return { error: "Bitte Mitarbeiter wählen." };
      if (await overlapping(employeeId, start!, end!)) return { error: "Für diesen Zeitraum gibt es schon eine Krankmeldung – bitte bearbeiten." };
      await monthsOpen(employeeId, start!, end!);
      const s = await db.sickLeave.create({ data: { employeeId, startDate: start!, endDate: end!, ...flags, createdById: admin.id } });
      await audit({ actorId: admin.id, subjectId: employeeId, action: "sick.admin_create", entityType: "SickLeave", entityId: s.id, after: snapshot(s), ip });
    }
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/krankheit");
  return { ok: "Gespeichert." };
}

export async function adminCancelSick(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Bitte Begründung angeben (z. B. „versehentlich erfasst“)." };
  const s = await db.sickLeave.findUnique({ where: { id: str(fd, "id") } });
  if (!s || s.cancelledAt) return { error: "Nicht gefunden." };
  try {
    await monthsOpen(s.employeeId, s.startDate, s.endDate);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  await db.sickLeave.update({ where: { id: s.id }, data: { cancelledAt: new Date(), cancelReason: reason } });
  await audit({ actorId: admin.id, subjectId: s.employeeId, action: "sick.cancel", entityType: "SickLeave", entityId: s.id, before: snapshot(s), reason, ip: await clientIp() });
  revalidatePath("/admin/krankheit");
  return { ok: "Storniert." };
}

/** Krankheit während Urlaub: betroffene Urlaubstage zurückbuchen (§ 9 BUrlG – AU muss vorliegen) */
export async function confirmVacationRefund(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const s = await db.sickLeave.findUnique({ where: { id: str(fd, "id") } });
  if (!s || s.cancelledAt || s.childSick) return { error: "Nicht gefunden." };
  const after = await db.sickLeave.update({ where: { id: s.id }, data: { vacationRefundConfirmedAt: new Date(), vacationRefundConfirmedById: admin.id } });
  await audit({ actorId: admin.id, subjectId: s.employeeId, action: "sick.vacation_refund", entityType: "SickLeave", entityId: s.id, after: snapshot(after), ip: await clientIp() });
  await db.notification.create({ data: { employeeId: s.employeeId, title: `Urlaubstage während Krankheit (${range(s)}) wurden zurückgebucht`, link: "/mein/urlaub" } });
  revalidatePath("/admin/krankheit");
  return { ok: "Urlaubstage zurückgebucht." };
}
