import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { berlinDay, berlinTimeOn, dayKey, fmtDate, fmtTime } from "@/lib/time";
import { parseHm, validateBlocks, type BlockInput } from "./blocks";
import { evaluateDayWarnings } from "./warnings";
import { addDays } from "./account-rules";

export class CorrectionError extends Error {}

/** Monatsabschluss: abgeschlossene Monate nur nach Wiedereröffnung änderbar */
export async function assertMonthOpen(employeeId: string, workDate: Date) {
  const c = await db.monthClosing.findUnique({
    where: { employeeId_year_month: { employeeId, year: workDate.getUTCFullYear(), month: workDate.getUTCMonth() + 1 } },
  });
  if (c && !c.reopenedAt) throw new CorrectionError("Dieser Monat ist abgeschlossen. Änderungen nur nach erneuter Freigabe (Monat wieder öffnen).");
}

/** Aktuelle Einträge eines Tages als Blöcke ("HH:MM") */
export async function currentBlocks(employeeId: string, workDate: Date): Promise<BlockInput[]> {
  const entries = await db.timeEntry.findMany({ where: { employeeId, workDate, voidedAt: null }, orderBy: { start: "asc" } });
  return entries.map((e) => ({ kind: e.kind, start: fmtTime(e.start), end: e.end ? fmtTime(e.end) : null }));
}

/**
 * Tag korrigieren: bisherige Einträge werden als überschrieben markiert (nie gelöscht),
 * neue Einträge mit Herkunft KORREKTUR angelegt, Änderung im Audit-Log mit Begründung.
 */
export async function replaceDayEntries(opts: {
  employeeId: string;
  workDate: Date;
  blocks: BlockInput[];
  actorId: string;
  reason: string;
  ip?: string | null;
  action?: string;
}): Promise<string> {
  const { employeeId, workDate, blocks, actorId } = opts;
  const reason = opts.reason.trim();
  if (reason.length < 5) throw new CorrectionError("Bitte eine Begründung angeben (mind. 5 Zeichen).");
  const today = berlinDay();
  if (workDate > today) throw new CorrectionError("Zukünftige Tage können nicht erfasst werden.");
  const err = validateBlocks(blocks, { allowOpenLast: dayKey(workDate) === dayKey(today) });
  if (err) throw new CorrectionError(err);
  await assertMonthOpen(employeeId, workDate);

  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const correctionId = randomUUID();
  const toDate = (hm: string) => (parseHm(hm) === 24 * 60 ? berlinTimeOn(addDays(workDate, 1), "00:00") : berlinTimeOn(workDate, hm));

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${employeeId} FOR UPDATE`;
    const old = await tx.timeEntry.findMany({ where: { employeeId, workDate, voidedAt: null }, orderBy: { start: "asc" } });
    if (old.length) {
      await tx.timeEntry.updateMany({ where: { id: { in: old.map((o) => o.id) } }, data: { voidedAt: new Date(), correctionId } });
    }
    for (const b of blocks) {
      await tx.timeEntry.create({
        data: {
          employeeId, kind: b.kind, start: toDate(b.start), end: b.end ? toDate(b.end) : null,
          workDate, origin: "KORREKTUR", correctionId, departmentId: emp.departmentId,
        },
      });
    }
    await audit({
      actorId, subjectId: employeeId, action: opts.action ?? "time.correct", entityType: "TimeDay", entityId: correctionId,
      before: { datum: dayKey(workDate), bloecke: old.map((o) => ({ art: o.kind, von: fmtTime(o.start), bis: o.end ? fmtTime(o.end) : null })) },
      after: { datum: dayKey(workDate), bloecke: blocks.map((b) => ({ art: b.kind, von: b.start, bis: b.end })) },
      reason, ip: opts.ip,
    }, tx);
    if (actorId !== employeeId) {
      await tx.notification.create({
        data: { employeeId, title: `Deine Zeiten vom ${fmtDate(workDate)} wurden geändert`, body: reason, link: "/mein/zeiten" },
      });
    }
  });

  await evaluateDayWarnings(employeeId, workDate);
  await evaluateDayWarnings(employeeId, addDays(workDate, 1));
  return correctionId;
}

/** Benachrichtigung an alle, die einen Antrag dieser Person genehmigen dürfen */
export async function notifyApprovers(employeeId: string, title: string, link: string) {
  const emp = await db.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const approvers = await db.employee.findMany({
    where: {
      status: "AKTIV",
      id: { not: employeeId },
      OR: [
        { roles: { has: "ADMIN" } },
        ...(emp.departmentId ? [{ roles: { has: "ABTEILUNGSLEITER" as const }, ledDepartments: { some: { id: emp.departmentId } } }] : []),
      ],
    },
    select: { id: true, roles: true },
  });
  if (approvers.length) {
    await db.notification.createMany({
      data: approvers.map((a) => ({ employeeId: a.id, title, link: a.roles.includes("ADMIN") ? "/admin/postfach" : link })),
    });
  }
}
