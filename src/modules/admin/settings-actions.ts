"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { isValidRange } from "@/lib/ip";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/guards";
import { getSettings, setSetting } from "./settings";

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function saveStampSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { employee: admin } = await requireAdmin();
  const before = await getSettings();
  const ranges = String(fd.get("ranges") ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const bad = ranges.filter((r) => !isValidRange(r));
  if (bad.length) return { error: `Ungültige Adresse/Bereich: ${bad.join(", ")} (Beispiel: 192.168.178.0/24)` };
  const mode = fd.get("missingBreakMode") === "hinweis" ? "hinweis" : "abzug";
  const personal = fd.get("stampFromPersonalDevices") === "on";
  const creditFromTime = String(fd.get("creditFromTime") ?? "").trim();
  if (creditFromTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(creditFromTime)) return { error: "Uhrzeit bitte als HH:MM angeben, z. B. 06:00." };
  const breakRule = fd.get("breakRule") === "betrieblich" ? "betrieblich" : "gesetzlich";
  const companyBreakMinutes = Number(fd.get("companyBreakMinutes") ?? 45);
  const companyBreakAfterHours = Number(String(fd.get("companyBreakAfterHours") ?? "6").replace(",", "."));
  if (!(companyBreakMinutes >= 0 && companyBreakMinutes <= 120) || !(companyBreakAfterHours >= 0 && companyBreakAfterHours <= 12)) {
    return { error: "Betriebliche Pause: Minuten 0–120, Stunden 0–12." };
  }
  const after = {
    stampFromPersonalDevices: personal, stampAllowedIpRanges: ranges, missingBreakMode: mode, creditFromTime,
    breakRule, companyBreakMinutes, companyBreakAfterMinutes: Math.round(companyBreakAfterHours * 60),
  } as const;
  for (const [k, v] of Object.entries(after)) await setSetting(k as keyof typeof after, v as never, admin.id);
  await audit({
    actorId: admin.id, action: "settings.stamp", entityType: "AppSetting", ip: await clientIp(),
    before: Object.fromEntries(Object.keys(after).map((k) => [k, before[k as keyof typeof before]])),
    after,
  });
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}
