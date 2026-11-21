"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/guards";
import { setSetting } from "./settings";

export type ActionState = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function addCompanyDays(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const from = str(fd, "from");
  const to = str(fd, "to") || from;
  const kind = str(fd, "kind") as "HALBER_TAG" | "BETRIEBSFERIEN" | "FREIER_TAG";
  const name = str(fd, "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return { error: "Bitte gültigen Zeitraum angeben." };
  if (!["HALBER_TAG", "BETRIEBSFERIEN", "FREIER_TAG"].includes(kind)) return { error: "Art wählen." };
  if (!name) return { error: "Bitte eine Bezeichnung angeben." };
  const countsAsVacation = kind === "BETRIEBSFERIEN" && fd.get("countsAsVacation") === "on";
  const targetFactor = kind === "HALBER_TAG" ? 0.5 : 0;
  let n = 0;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    if (n++ > 60) return { error: "Höchstens 60 Tage auf einmal." };
    await db.companyDay.upsert({ where: { date: d }, create: { date: d, kind, name, targetFactor, countsAsVacation }, update: { kind, name, targetFactor, countsAsVacation } });
  }
  await audit({ actorId: admin.id, action: "calendar.add", entityType: "CompanyDay", after: { from, to, kind, name, countsAsVacation }, ip: await clientIp() });
  revalidatePath("/admin/kalender");
  return { ok: `${n} Tag(e) gespeichert.` };
}

export async function removeCompanyDay(id: string) {
  const { employee: admin } = await requireAdmin();
  const d = await db.companyDay.delete({ where: { id } });
  await audit({ actorId: admin.id, action: "calendar.remove", entityType: "CompanyDay", entityId: id, before: d, ip: await clientIp() });
  revalidatePath("/admin/kalender");
}

export async function addChristmasHalfDays(year: number) {
  const { employee: admin } = await requireAdmin();
  for (const [md, name] of [["12-24", "Heiligabend"], ["12-31", "Silvester"]] as const) {
    const date = new Date(`${year}-${md}T00:00:00Z`);
    await db.companyDay.upsert({ where: { date }, create: { date, kind: "HALBER_TAG", name, targetFactor: 0.5 }, update: {} });
  }
  await audit({ actorId: admin.id, action: "calendar.add", entityType: "CompanyDay", after: { year, tage: "Heiligabend/Silvester halber Tag" }, ip: await clientIp() });
  revalidatePath("/admin/kalender");
}

export async function saveRounding(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { employee: admin } = await requireAdmin();
  const r = Number(str(fd, "roundingMinutes"));
  if (![0, 5, 10, 15].includes(r)) return { error: "Ungültige Rundung." };
  await setSetting("roundingMinutes", r, admin.id);
  await audit({ actorId: admin.id, action: "settings.rounding", entityType: "AppSetting", after: { roundingMinutes: r }, ip: await clientIp() });
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}
