"use server";

import { revalidatePath } from "next/cache";
import type { AbsenceRequest, Employee } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { berlinDay, fmtDate } from "@/lib/time";
import { leadsDepartment, requireAdmin, requireEmployee } from "@/modules/auth/guards";
import { assertMonthOpen, CorrectionError, notifyApprovers } from "@/modules/zeiterfassung/corrections";
import { addDays } from "@/modules/zeiterfassung/account-rules";
import { ACTIVE_STATUSES, computeRequestDays, fmtDays, vacationOverview } from "./vacation";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const parseDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const range = (r: Pick<AbsenceRequest, "startDate" | "endDate">) =>
  r.startDate.getTime() === r.endDate.getTime() ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`;

/** alle betroffenen Monate müssen offen sein */
async function assertMonthsOpen(employeeId: string, start: Date, end: Date) {
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    await assertMonthOpen(employeeId, d);
  }
}

interface Parsed {
  typeId: string;
  start: Date;
  end: Date;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  comment: string | null;
}

async function parseAndValidate(employeeId: string, fd: FormData, opts: { allowPastDays: number }): Promise<{ error: string } | (Parsed & { days: number; type: { id: string; name: string; requiresApproval: boolean; deductsVacation: boolean } })> {
  const type = await db.absenceType.findFirst({ where: { id: str(fd, "typeId"), active: true } });
  if (!type) return { error: "Bitte eine Abwesenheitsart wählen." };
  const start = parseDay(str(fd, "start"));
  const end = parseDay(str(fd, "end") || str(fd, "start"));
  if (!start || !end) return { error: "Bitte Zeitraum angeben." };
  if (end < start) return { error: "„bis“ darf nicht vor „von“ liegen." };
  if (end.getTime() - start.getTime() > 120 * 86_400_000) return { error: "Höchstens 4 Monate am Stück." };
  if (start < addDays(berlinDay(), -opts.allowPastDays)) return { error: "Dieser Zeitraum liegt zu weit in der Vergangenheit. Bitte im Büro melden." };
  if (end > addDays(berlinDay(), 2 * 366)) return { error: "Zu weit in der Zukunft." };
  const halfDayStart = fd.get("halfDayStart") === "on";
  const halfDayEnd = fd.get("halfDayEnd") === "on" && end > start;
  const days = await computeRequestDays(employeeId, start, end, halfDayStart, halfDayEnd);
  if (days <= 0) return { error: "In diesem Zeitraum liegen keine Arbeitstage (Wochenende, Feiertag oder arbeitsfrei)." };
  const overlap = await db.absenceRequest.findFirst({
    where: { employeeId, status: { in: [...ACTIVE_STATUSES] }, startDate: { lte: end }, endDate: { gte: start } },
  });
  if (overlap) return { error: `Überschneidet sich mit einem bestehenden Antrag (${range(overlap)}).` };
  const comment = str(fd, "comment").slice(0, 500) || null;
  return { typeId: type.id, start, end, halfDayStart, halfDayEnd, comment, days, type };
}

// ───────────── Mitarbeiter ─────────────

export async function requestAbsence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const p = await parseAndValidate(emp.id, fd, { allowPastDays: 31 });
  if ("error" in p) return p;
  try {
    await assertMonthsOpen(emp.id, p.start, p.end);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  const status = p.type.requiresApproval ? "BEANTRAGT" : "GENEHMIGT";
  const r = await db.absenceRequest.create({
    data: { employeeId: emp.id, typeId: p.typeId, startDate: p.start, endDate: p.end, halfDayStart: p.halfDayStart, halfDayEnd: p.halfDayEnd, days: p.days, comment: p.comment, status },
  });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "absence.request", entityType: "AbsenceRequest", entityId: r.id, after: { art: p.type.name, von: p.start, bis: p.end, tage: p.days, status }, ip: await clientIp() });
  if (status === "BEANTRAGT") await notifyApprovers(emp.id, `${p.type.name}santrag von ${emp.firstName} ${emp.lastName}: ${range(r)}`, "/mein/abteilung");

  let note = "";
  if (p.type.deductsVacation) {
    const ov = await vacationOverview(emp.id, p.start.getUTCFullYear());
    if (ov.available < 0) note = ` Achtung: Damit fehlen ${fmtDays(-ov.available)} Urlaub.`;
  }
  revalidatePath("/mein/urlaub");
  return { ok: `${p.type.name} (${fmtDays(p.days)}) ${status === "BEANTRAGT" ? "beantragt" : "eingetragen"}.${note}` };
}

/** Offenen Antrag zurückziehen bzw. Stornierung eines genehmigten Antrags beantragen */
export async function cancelOwnAbsence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const r = await db.absenceRequest.findUnique({ where: { id: str(fd, "id") }, include: { type: true } });
  if (!r || r.employeeId !== emp.id) return { error: "Antrag nicht gefunden." };
  const ip = await clientIp();
  if (r.status === "BEANTRAGT") {
    await db.absenceRequest.update({ where: { id: r.id }, data: { status: "STORNIERT", decidedAt: new Date() } });
    await audit({ actorId: emp.id, subjectId: emp.id, action: "absence.withdraw", entityType: "AbsenceRequest", entityId: r.id, ip });
    revalidatePath("/mein/urlaub");
    return { ok: "Antrag zurückgezogen." };
  }
  if (r.status === "GENEHMIGT") {
    const reason = str(fd, "reason");
    await db.absenceRequest.update({ where: { id: r.id }, data: { status: "STORNO_BEANTRAGT", cancelRequestedAt: new Date(), cancelReason: reason || null } });
    await audit({ actorId: emp.id, subjectId: emp.id, action: "absence.cancel_request", entityType: "AbsenceRequest", entityId: r.id, reason: reason || null, ip });
    await notifyApprovers(emp.id, `Stornierung erbeten: ${r.type.name} von ${emp.firstName} ${emp.lastName} (${range(r)})`, "/mein/abteilung");
    revalidatePath("/mein/urlaub");
    return { ok: "Stornierung beantragt – sie muss noch bestätigt werden." };
  }
  return { error: "Dieser Antrag kann nicht mehr geändert werden." };
}

// ───────────── Genehmigen / Ablehnen ─────────────

async function decide(actor: Employee, id: string, approve: boolean, reason: string): Promise<ActionState> {
  const r = await db.absenceRequest.findUnique({ where: { id }, include: { type: true, employee: true } });
  if (!r || !["BEANTRAGT", "STORNO_BEANTRAGT"].includes(r.status)) return { error: "Antrag nicht gefunden oder bereits entschieden." };
  if (!approve && r.status === "BEANTRAGT" && reason.trim().length < 3) return { error: "Bitte eine Begründung für die Ablehnung angeben." };
  try {
    await assertMonthsOpen(r.employeeId, r.startDate, r.endDate);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  const storno = r.status === "STORNO_BEANTRAGT";
  const status = storno ? (approve ? "STORNIERT" : "GENEHMIGT") : approve ? "GENEHMIGT" : "ABGELEHNT";
  await db.absenceRequest.update({
    where: { id: r.id },
    data: { status, decidedById: actor.id, decidedAt: new Date(), ...(storno ? {} : { decisionReason: reason || null }) },
  });
  await audit({
    actorId: actor.id, subjectId: r.employeeId, entityType: "AbsenceRequest", entityId: r.id, reason: reason || null, ip: await clientIp(),
    action: storno ? (approve ? "absence.cancel_approve" : "absence.cancel_reject") : approve ? "absence.approve" : "absence.reject",
    before: { status: r.status }, after: { status },
  });
  const what = storno ? `Stornierung ${r.type.name} ${range(r)}` : `${r.type.name} ${range(r)}`;
  await db.notification.create({
    data: { employeeId: r.employeeId, title: `${what}: ${approve ? (storno ? "bestätigt" : "genehmigt") : "abgelehnt"}`, body: reason || null, link: "/mein/urlaub" },
  });
  revalidatePath("/admin/postfach");
  revalidatePath("/mein/abteilung");
  revalidatePath("/admin/abwesenheiten");
  return { ok: approve ? "Genehmigt." : "Abgelehnt." };
}

export async function decideAbsenceAdmin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee } = await requireAdmin();
  return decide(employee, str(fd, "id"), str(fd, "decision") === "approve", str(fd, "reason"));
}

export async function decideAbsenceLead(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const lead = await requireEmployee();
  const r = await db.absenceRequest.findUnique({ where: { id: str(fd, "id") }, include: { employee: true } });
  const me = await db.employee.findUniqueOrThrow({ where: { id: lead.id }, include: { ledDepartments: true } });
  if (!r || r.employeeId === lead.id || !leadsDepartment(me, r.employee.departmentId)) return { error: "Keine Berechtigung für diesen Antrag." };
  return decide(lead, r.id, str(fd, "decision") === "approve", str(fd, "reason"));
}

// ───────────── Admin: direkt eintragen / stornieren ─────────────

export async function adminCreateAbsence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  if (!employeeId) return { error: "Bitte Mitarbeiter wählen." };
  const p = await parseAndValidate(employeeId, fd, { allowPastDays: 400 });
  if ("error" in p) return p;
  try {
    await assertMonthsOpen(employeeId, p.start, p.end);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  const r = await db.absenceRequest.create({
    data: {
      employeeId, typeId: p.typeId, startDate: p.start, endDate: p.end, halfDayStart: p.halfDayStart, halfDayEnd: p.halfDayEnd,
      days: p.days, comment: p.comment, status: "GENEHMIGT", decidedById: admin.id, decidedAt: new Date(), createdById: admin.id,
    },
  });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "absence.admin_create", entityType: "AbsenceRequest", entityId: r.id, after: { art: p.type.name, von: p.start, bis: p.end, tage: p.days }, ip: await clientIp() });
  await db.notification.create({ data: { employeeId, title: `${p.type.name} eingetragen: ${range(r)}`, link: "/mein/urlaub" } });
  revalidatePath("/admin/abwesenheiten");
  return { ok: `${p.type.name} (${fmtDays(p.days)}) eingetragen.` };
}

export async function adminCancelAbsence(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const reason = str(fd, "reason");
  if (reason.length < 3) return { error: "Bitte Begründung angeben." };
  const r = await db.absenceRequest.findUnique({ where: { id: str(fd, "id") }, include: { type: true } });
  if (!r || !ACTIVE_STATUSES.includes(r.status as never)) return { error: "Nicht gefunden." };
  try {
    await assertMonthsOpen(r.employeeId, r.startDate, r.endDate);
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  await db.absenceRequest.update({ where: { id: r.id }, data: { status: "STORNIERT", decidedById: admin.id, decidedAt: new Date(), cancelReason: reason } });
  await audit({ actorId: admin.id, subjectId: r.employeeId, action: "absence.admin_cancel", entityType: "AbsenceRequest", entityId: r.id, before: { status: r.status }, after: { status: "STORNIERT" }, reason, ip: await clientIp() });
  await db.notification.create({ data: { employeeId: r.employeeId, title: `${r.type.name} ${range(r)} storniert`, body: reason, link: "/mein/urlaub" } });
  revalidatePath("/admin/abwesenheiten");
  return { ok: "Storniert." };
}

// ───────────── Admin: Urlaubsanspruch ─────────────

export async function saveEntitlement(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  const year = Number(str(fd, "year"));
  if (!(year >= 2000 && year <= 2100)) return { error: "Jahr ungültig." };
  const num = (k: string) => {
    const v = str(fd, k).replace(",", ".");
    return v === "" ? null : Number(v);
  };
  const days = num("days");
  const carry = num("carryOverOverride");
  if (days === null || !(days >= 0 && days <= 60) || (days * 2) % 1 !== 0) return { error: "Urlaubstage: 0–60, halbe Tage erlaubt (z. B. 30 oder 27,5)." };
  if (carry !== null && (!(carry >= 0 && carry <= 100) || (carry * 2) % 1 !== 0)) return { error: "Übertrag: 0–100, halbe Tage erlaubt." };
  const note = str(fd, "note").slice(0, 200) || null;
  const before = await db.vacationEntitlement.findUnique({ where: { employeeId_year: { employeeId, year } } });
  await db.vacationEntitlement.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: { employeeId, year, days, carryOverOverride: carry, note },
    update: { days, carryOverOverride: carry, note },
  });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "vacation.entitlement", entityType: "VacationEntitlement", before, after: { year, days, carryOverOverride: carry, note }, ip: await clientIp() });
  revalidatePath(`/admin/mitarbeiter/${employeeId}`);
  return { ok: `Urlaubsanspruch ${year} gespeichert.` };
}

/** Vorschau: Anzahl Arbeitstage im Zeitraum (für das Antragsformular) */
export async function previewAbsenceDays(start: string, end: string, halfDayStart: boolean, halfDayEnd: boolean, employeeId?: string): Promise<number | null> {
  let id: string;
  if (employeeId) id = (await requireAdmin(), employeeId);
  else id = (await requireEmployee()).id;
  const s = parseDay(start);
  const e = parseDay(end || start);
  if (!s || !e || e < s || e.getTime() - s.getTime() > 400 * 86_400_000) return null;
  return computeRequestDays(id, s, e, halfDayStart, halfDayEnd && e > s);
}
