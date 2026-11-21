"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/guards";
import { parseHm } from "@/modules/zeiterfassung/blocks";

export type ActionState = { error?: string; ok?: string } | undefined;
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const parseDay = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

/** Neues Arbeitszeitmodell ab Datum (bisherige Versionen bleiben für die Vergangenheit gültig) */
export async function saveSchedule(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  const validFrom = parseDay(str(fd, "validFrom"));
  if (!validFrom) return { error: "Bitte „gültig ab“ angeben." };
  const data: Record<string, number> = {};
  for (const d of DAYS) {
    const raw = str(fd, d) || "0:00";
    const v = parseHm(raw.includes(":") ? raw : `${raw}:00`);
    if (v === null || v > 12 * 60) return { error: `Ungültige Stundenzahl „${raw}“ (Format 8:00, höchstens 12 Std.).` };
    data[`${d}Minutes`] = v;
  }
  const before = await db.workSchedule.findFirst({ where: { employeeId, validFrom: { lte: validFrom } }, orderBy: { validFrom: "desc" } });
  const s = await db.workSchedule.upsert({
    where: { employeeId_validFrom: { employeeId, validFrom } },
    create: { employeeId, validFrom, ...data },
    update: data,
  });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "schedule.save", entityType: "WorkSchedule", entityId: s.id, before, after: s, ip: await clientIp() });
  revalidatePath(`/admin/mitarbeiter/${employeeId}`);
  return { ok: "Arbeitszeitmodell gespeichert." };
}

export async function setTimeAccountStart(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const employeeId = str(fd, "employeeId");
  const day = parseDay(str(fd, "timeAccountStart"));
  if (!day) return { error: "Datum angeben." };
  const before = await db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { timeAccountStart: true } });
  await db.employee.update({ where: { id: employeeId }, data: { timeAccountStart: day } });
  await audit({ actorId: admin.id, subjectId: employeeId, action: "employee.time_account_start", entityType: "Employee", entityId: employeeId, before, after: { timeAccountStart: day }, ip: await clientIp() });
  revalidatePath(`/admin/mitarbeiter/${employeeId}`);
  return { ok: "Gespeichert." };
}
