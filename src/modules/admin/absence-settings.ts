"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/guards";
import { getSettings, setSetting } from "./settings";

export type ActionState = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function saveVacationSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const before = await getSettings();
  const days = Number(str(fd, "defaultVacationDays").replace(",", "."));
  if (!(days >= 20 && days <= 40)) return { error: "Standard-Urlaub: 20–40 Tage (gesetzlich mindestens 20 bei 5-Tage-Woche)." };
  const expiry = str(fd, "carryOverExpiry");
  const m = /^(\d{2})\.(\d{2})\.?$/.exec(expiry);
  if (!m || Number(m[1]) > 31 || Number(m[2]) > 12) return { error: "Verfallsdatum als TT.MM angeben, z. B. 31.03." };
  const warn = Number(str(fd, "carryOverWarnDays"));
  if (!(warn >= 7 && warn <= 180)) return { error: "Hinweis: 7–180 Tage vorher." };
  const after = {
    defaultVacationDays: days,
    vacationExpiry: fd.get("vacationExpiry") === "on",
    carryOverExpiry: `${m[2]}-${m[1]}`,
    carryOverWarnDays: warn,
    hideAbsenceReasonForColleagues: fd.get("hideAbsenceReasonForColleagues") === "on",
  };
  for (const [k, v] of Object.entries(after)) await setSetting(k as keyof typeof after, v as never, admin.id);
  await audit({ actorId: admin.id, action: "settings.vacation", entityType: "AppSetting", before: Object.fromEntries(Object.keys(after).map((k) => [k, before[k as keyof typeof before]])), after, ip: await clientIp() });
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}

export async function saveAbsenceType(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name").slice(0, 60);
  if (!name) return { error: "Bitte einen Namen angeben." };
  const data = {
    name,
    creditsTarget: fd.get("creditsTarget") === "on",
    requiresApproval: fd.get("requiresApproval") === "on",
    active: fd.get("active") !== "off",
    color: /^#[0-9a-f]{6}$/i.test(str(fd, "color")) ? str(fd, "color") : "#16a34a",
  };
  if (id) {
    const before = await db.absenceType.findUniqueOrThrow({ where: { id } });
    // Systemarten: Kategorie/Urlaubsabzug fest, nur Name/Farbe/Genehmigung/aktiv änderbar
    const t = await db.absenceType.update({ where: { id }, data: before.system ? { name, color: data.color, requiresApproval: data.requiresApproval, active: data.active } : data });
    await audit({ actorId: admin.id, action: "absence_type.update", entityType: "AbsenceType", entityId: id, before, after: t, ip: await clientIp() });
  } else {
    const code = name.toUpperCase().normalize("NFKD").replace(/[^A-Z0-9]+/g, "_").slice(0, 30) + "_" + Date.now().toString(36).slice(-4).toUpperCase();
    const t = await db.absenceType.create({ data: { ...data, code, category: "SONSTIGE", deductsVacation: false } });
    await audit({ actorId: admin.id, action: "absence_type.create", entityType: "AbsenceType", entityId: t.id, after: t, ip: await clientIp() });
  }
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}

export async function saveMinStaffing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const depts = await db.department.findMany();
  for (const d of depts) {
    const raw = str(fd, `min_${d.id}`);
    const v = raw === "" ? null : Number(raw);
    if (v !== null && !(Number.isInteger(v) && v >= 0 && v <= 50)) return { error: `Mindestbesetzung ${d.name}: ganze Zahl 0–50.` };
    if (v !== d.minStaffing) {
      await db.department.update({ where: { id: d.id }, data: { minStaffing: v } });
      await audit({ actorId: admin.id, action: "department.min_staffing", entityType: "Department", entityId: d.id, before: { minStaffing: d.minStaffing }, after: { minStaffing: v }, ip: await clientIp() });
    }
  }
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}
