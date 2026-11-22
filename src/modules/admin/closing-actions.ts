"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { berlinDay, monthName } from "@/lib/time";
import { requireAdmin, requireEmployee } from "@/modules/auth/guards";
import { getSettings } from "./settings";
import { monthSummary } from "./month-report";

export type ActionState = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function parseYm(fd: FormData) {
  const m = /^(\d{4})-(\d{2})$/.exec(str(fd, "monat"));
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/** Monat abschließen (einzeln oder alle). Danach sind Änderungen nur nach Wiedereröffnung möglich. */
export async function closeMonth(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const ym = parseYm(fd);
  if (!ym) return { error: "Monat fehlt." };
  const lastDay = new Date(Date.UTC(ym.year, ym.month, 0));
  if (lastDay >= berlinDay()) return { error: "Ein Monat kann erst nach seinem Ende abgeschlossen werden." };
  const ids = fd.getAll("employeeId").map(String).filter(Boolean);
  if (!ids.length) return { error: "Keine Mitarbeiter ausgewählt." };
  const settings = await getSettings();
  const ip = await clientIp();
  let n = 0;
  for (const employeeId of ids) {
    const existing = await db.monthClosing.findUnique({ where: { employeeId_year_month: { employeeId, ...ym } } });
    if (existing && !existing.reopenedAt) continue;
    const s = await monthSummary(employeeId, ym.year, ym.month);
    const data = {
      closedAt: new Date(), closedById: admin.id, balanceMinutes: s.closingBalance,
      summary: JSON.parse(JSON.stringify({ ...s, closedAt: undefined, employeeConfirmedAt: undefined })),
      employeeConfirmedAt: null, reopenedAt: null, reopenReason: null,
    };
    await db.monthClosing.upsert({ where: { employeeId_year_month: { employeeId, ...ym } }, create: { employeeId, ...ym, ...data }, update: data });
    await audit({ actorId: admin.id, subjectId: employeeId, action: "month.close", entityType: "MonthClosing", entityId: `${employeeId}:${ym.year}-${ym.month}`, after: { saldo: s.closingBalance, soll: s.targetMinutes, ist: s.actualMinutes }, ip });
    if (settings.monthConfirmation) {
      await db.notification.create({ data: { employeeId, title: `Monatsnachweis ${monthName(ym.year, ym.month)} bitte prüfen und bestätigen`, link: `/mein/zeiten?monat=${ym.year}-${String(ym.month).padStart(2, "0")}` } });
    }
    n++;
  }
  revalidatePath("/admin/auswertung");
  return { ok: n ? `${n} Monatsnachweis(e) abgeschlossen.` : "Bereits abgeschlossen." };
}

/** Abgeschlossenen Monat wieder öffnen (erneute Freigabe für Änderungen) */
export async function reopenMonth(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const ym = parseYm(fd);
  const employeeId = str(fd, "employeeId");
  const reason = str(fd, "reason");
  if (!ym || !employeeId) return { error: "Angaben fehlen." };
  if (reason.length < 5) return { error: "Bitte begründen, warum der Monat geändert werden muss." };
  const c = await db.monthClosing.findUnique({ where: { employeeId_year_month: { employeeId, ...ym } } });
  if (!c || c.reopenedAt) return { error: "Monat ist nicht abgeschlossen." };
  await db.monthClosing.update({ where: { id: c.id }, data: { reopenedAt: new Date(), reopenReason: reason } });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "month.reopen", entityType: "MonthClosing", entityId: c.id, before: { saldo: c.balanceMinutes }, reason, ip: await clientIp() });
  revalidatePath("/admin/auswertung");
  return { ok: "Monat wieder geöffnet. Nach den Änderungen bitte erneut abschließen." };
}

/** Mitarbeiter bestätigt den abgeschlossenen Monatsnachweis */
export async function confirmMonth(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const emp = await requireEmployee();
  const ym = parseYm(fd);
  if (!ym) return { error: "Monat fehlt." };
  const c = await db.monthClosing.findUnique({ where: { employeeId_year_month: { employeeId: emp.id, ...ym } } });
  if (!c || c.reopenedAt) return { error: "Dieser Monat ist noch nicht abgeschlossen." };
  if (c.employeeConfirmedAt) return { ok: "Bereits bestätigt." };
  await db.monthClosing.update({ where: { id: c.id }, data: { employeeConfirmedAt: new Date() } });
  await audit({ actorId: emp.id, subjectId: emp.id, action: "month.confirm", entityType: "MonthClosing", entityId: c.id, ip: await clientIp() });
  revalidatePath("/mein/zeiten");
  return { ok: "Danke – Monatsnachweis bestätigt." };
}
