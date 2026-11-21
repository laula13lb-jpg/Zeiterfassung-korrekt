"use server";

import { revalidatePath } from "next/cache";
import type { Employee } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { berlinDay, fmtDate } from "@/lib/time";
import { leadsDepartment, requireAdmin, requireEmployee } from "@/modules/auth/guards";
import { blocksFromSimple, validateBlocks, type BlockInput } from "./blocks";
import { CorrectionError, notifyApprovers, replaceDayEntries } from "./corrections";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const parseDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

// ───────────── Mitarbeiter: Korrekturantrag ─────────────

export async function requestCorrection(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const day = parseDay(str(fd, "datum"));
  if (!day) return { error: "Bitte ein Datum wählen." };
  if (day > berlinDay()) return { error: "Für zukünftige Tage ist kein Korrekturantrag möglich." };
  const message = str(fd, "message");
  if (message.length < 5) return { error: "Bitte kurz beschreiben, was korrigiert werden soll." };
  const blocks = blocksFromSimple(str(fd, "kommen"), str(fd, "gehen"), [
    { von: str(fd, "p1von"), bis: str(fd, "p1bis") },
    { von: str(fd, "p2von"), bis: str(fd, "p2bis") },
  ]);
  if (typeof blocks === "string") return { error: blocks };
  const open = await db.correctionRequest.findFirst({ where: { employeeId: emp.id, workDate: day, status: "BEANTRAGT" } });
  if (open) return { error: "Für diesen Tag gibt es schon einen offenen Antrag." };

  const req = await db.correctionRequest.create({ data: { employeeId: emp.id, workDate: day, message, proposed: { blocks } as never } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "correction.request", entityType: "CorrectionRequest", entityId: req.id, after: { blocks }, reason: message, ip: await clientIp() });
  await notifyApprovers(emp.id, `Korrekturantrag von ${emp.firstName} ${emp.lastName} für ${fmtDate(day)}`, "/mein/abteilung");
  revalidatePath("/mein/zeiten");
  return { ok: "Antrag gestellt. Du wirst benachrichtigt, sobald entschieden ist." };
}

export async function withdrawCorrection(id: string) {
  const emp = await requireEmployee();
  const r = await db.correctionRequest.findUnique({ where: { id } });
  if (!r || r.employeeId !== emp.id || r.status !== "BEANTRAGT") return;
  await db.correctionRequest.update({ where: { id }, data: { status: "STORNIERT", decidedAt: new Date() } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "correction.withdraw", entityType: "CorrectionRequest", entityId: id });
  revalidatePath("/mein/zeiten");
}

// ───────────── Genehmigen / Ablehnen ─────────────

async function decide(actor: Employee, requestId: string, approve: boolean, reason: string): Promise<ActionState> {
  const r = await db.correctionRequest.findUnique({ where: { id: requestId }, include: { employee: true } });
  if (!r || r.status !== "BEANTRAGT") return { error: "Antrag nicht gefunden oder bereits entschieden." };
  if (!approve && reason.trim().length < 3) return { error: "Bitte eine Begründung für die Ablehnung angeben." };
  const ip = await clientIp();
  let correctionId: string | null = null;
  if (approve) {
    const blocks = ((r.proposed as { blocks?: BlockInput[] } | null)?.blocks ?? []) as BlockInput[];
    try {
      correctionId = await replaceDayEntries({
        employeeId: r.employeeId, workDate: r.workDate, blocks, actorId: actor.id, ip, action: "time.correct_request",
        reason: `Korrekturantrag genehmigt: „${r.message}“${reason ? ` – ${reason}` : ""}`,
      });
    } catch (e) {
      if (e instanceof CorrectionError) return { error: e.message };
      throw e;
    }
  }
  await db.correctionRequest.update({
    where: { id: r.id },
    data: { status: approve ? "GENEHMIGT" : "ABGELEHNT", decidedById: actor.id, decidedAt: new Date(), decisionReason: reason || null, correctionId },
  });
  await audit({ actorId: actor.id, subjectId: r.employeeId, action: approve ? "correction.approve" : "correction.reject", entityType: "CorrectionRequest", entityId: r.id, reason: reason || null, ip });
  await db.notification.create({
    data: {
      employeeId: r.employeeId,
      title: `Korrekturantrag für ${fmtDate(r.workDate)} ${approve ? "genehmigt" : "abgelehnt"}`,
      body: reason || null,
      link: "/mein/zeiten",
    },
  });
  revalidatePath("/admin/postfach");
  revalidatePath("/mein/abteilung");
  return { ok: approve ? "Genehmigt und Zeiten übernommen." : "Abgelehnt." };
}

export async function decideCorrectionAdmin(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee } = await requireAdmin();
  return decide(employee, str(fd, "id"), str(fd, "decision") === "approve", str(fd, "reason"));
}

export async function decideCorrectionLead(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const lead = await requireEmployee();
  const r = await db.correctionRequest.findUnique({ where: { id: str(fd, "id") }, include: { employee: true } });
  const withDepts = await db.employee.findUniqueOrThrow({ where: { id: lead.id }, include: { ledDepartments: true } });
  // serverseitig: nur eigene Abteilung, nie eigene Anträge
  if (!r || r.employeeId === lead.id || !leadsDepartment(withDepts, r.employee.departmentId)) return { error: "Keine Berechtigung für diesen Antrag." };
  return decide(lead, r.id, str(fd, "decision") === "approve", str(fd, "reason"));
}

// ───────────── Admin: Tag direkt korrigieren ─────────────

export async function adminCorrectDay(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  const day = parseDay(str(fd, "datum"));
  if (!day) return { error: "Datum fehlt." };
  let blocks: BlockInput[];
  try {
    blocks = JSON.parse(str(fd, "blocks") || "[]");
  } catch {
    return { error: "Ungültige Eingabe." };
  }
  const err = validateBlocks(blocks, { allowOpenLast: day.getTime() === berlinDay().getTime() });
  if (err) return { error: err };
  try {
    await replaceDayEntries({ employeeId, workDate: day, blocks, actorId: admin.id, reason: str(fd, "reason"), ip: await clientIp() });
  } catch (e) {
    if (e instanceof CorrectionError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/zeiten`);
  return { ok: "Gespeichert. Die Änderung ist im Änderungsprotokoll vermerkt." };
}

// ───────────── Admin: Saldo-Buchungen ─────────────

export async function addBalanceAdjustment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  const kind = str(fd, "kind") as "KORREKTUR" | "FREIZEITAUSGLEICH" | "AUSZAHLUNG" | "UEBERTRAG";
  if (!["KORREKTUR", "FREIZEITAUSGLEICH", "AUSZAHLUNG", "UEBERTRAG"].includes(kind)) return { error: "Art wählen." };
  const m = /^([+-])?\s*(\d{1,4})(?::(\d{2}))?$/.exec(str(fd, "amount").replace(",", ":"));
  if (!m) return { error: "Stunden als z. B. 2:30 oder -1:15 angeben." };
  let minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  if (m[1] === "-") minutes = -minutes;
  // Freizeitausgleich und Auszahlung verringern immer das Konto
  if (kind === "FREIZEITAUSGLEICH" || kind === "AUSZAHLUNG") minutes = -Math.abs(minutes);
  if (minutes === 0) return { error: "Betrag darf nicht 0 sein." };
  const reason = str(fd, "reason");
  if (reason.length < 5) return { error: "Bitte eine Begründung angeben." };
  const day = parseDay(str(fd, "datum")) ?? berlinDay();
  const adj = await db.balanceAdjustment.create({ data: { employeeId, date: day, minutes, kind, reason, createdById: admin.id } });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "balance.adjust", entityType: "BalanceAdjustment", entityId: adj.id, after: { minutes, kind, datum: str(fd, "datum") }, reason, ip: await clientIp() });
  await db.notification.create({ data: { employeeId, title: "Buchung auf deinem Zeitkonto", body: reason, link: "/mein/zeiten" } });
  revalidatePath("/admin/zeiten");
  return { ok: "Gebucht." };
}

// ───────────── Admin: Hinweise erledigen ─────────────

export async function resolveWarning(id: string) {
  const { employee: admin } = await requireAdmin();
  const w = await db.timeWarning.update({ where: { id }, data: { resolvedAt: new Date(), resolvedById: admin.id } });
  await audit({ actorId: admin.id, subjectId: w.employeeId, action: "warning.resolve", entityType: "TimeWarning", entityId: id });
  revalidatePath("/admin");
}
