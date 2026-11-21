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
  const mode = fd.get("missingBreakMode") === "abzug" ? "abzug" : "hinweis";
  const personal = fd.get("stampFromPersonalDevices") === "on";
  await setSetting("stampFromPersonalDevices", personal, admin.id);
  await setSetting("stampAllowedIpRanges", ranges, admin.id);
  await setSetting("missingBreakMode", mode, admin.id);
  await audit({
    actorId: admin.id, action: "settings.stamp", entityType: "AppSetting", ip: await clientIp(),
    before: { stampFromPersonalDevices: before.stampFromPersonalDevices, stampAllowedIpRanges: before.stampAllowedIpRanges, missingBreakMode: before.missingBreakMode },
    after: { stampFromPersonalDevices: personal, stampAllowedIpRanges: ranges, missingBreakMode: mode },
  });
  revalidatePath("/admin/einstellungen");
  return { ok: "Gespeichert." };
}
