"use server";

import { revalidatePath } from "next/cache";
import { clientIp } from "@/lib/request";
import { ipInRanges } from "@/lib/ip";
import { fmtTime } from "@/lib/time";
import { requireEmployee } from "@/modules/auth/guards";
import { getSettings } from "@/modules/admin/settings";
import { STAMP_LABEL, type StampType } from "./rules";
import { performStamp } from "./stamp";

/** Darf von diesem Gerät/Netz persönlich gestempelt werden? (serverseitig geprüft) */
export async function personalStampAllowed(ip: string | null): Promise<{ allowed: boolean; reason?: string }> {
  const s = await getSettings();
  if (!s.stampFromPersonalDevices) return { allowed: false, reason: "Stempeln ist nur am Werkstatt-Terminal möglich." };
  if (s.stampAllowedIpRanges.length && !ipInRanges(ip, s.stampAllowedIpRanges)) {
    return { allowed: false, reason: "Stempeln ist nur im Firmennetz (WLAN der Werkstatt) möglich." };
  }
  return { allowed: true };
}

export async function stampPersonal(type: StampType, clientId: string): Promise<{ ok?: string; error?: string; notice?: string }> {
  const emp = await requireEmployee();
  const ip = await clientIp();
  const perm = await personalStampAllowed(ip);
  if (!perm.allowed) return { error: perm.reason };
  if (!["KOMMEN", "PAUSE_START", "PAUSE_ENDE", "GEHEN"].includes(type)) return { error: "Unbekannte Aktion." };
  const r = await performStamp({ employeeId: emp.id, type, source: "PERSOENLICH", clientId, ip });
  revalidatePath("/mein");
  if (!r.ok) return { error: r.error };
  return { ok: `${STAMP_LABEL[type]} um ${fmtTime(r.at)} gespeichert.`, notice: r.autoClosedNotice };
}
