"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/crypto";
import { clientIp } from "@/lib/request";
import { requireAdmin } from "@/modules/auth/guards";
import { newActivationCode } from "@/modules/zeiterfassung/terminal-device";

export type CodeState = { error?: string; code?: string; name?: string } | undefined;

/** Neues Terminal anlegen bzw. für ein bestehendes einen neuen Freischaltcode erzeugen */
export async function createTerminalCode(_prev: CodeState, fd: FormData): Promise<CodeState> {
  const { employee: admin } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const code = newActivationCode();
  const data = { activationCodeHash: sha256(code), activationExpiresAt: new Date(Date.now() + 24 * 3600_000) };
  let t;
  if (id) {
    // neues Gerät koppeln: altes Gerätecookie wird ungültig
    t = await db.terminalDevice.update({ where: { id }, data: { ...data, tokenHash: null, active: true } });
  } else {
    if (!name) return { error: "Bitte einen Namen angeben, z. B. „Werkstatt-Tablet“." };
    t = await db.terminalDevice.create({ data: { name, ...data } });
  }
  await audit({ actorId: admin.id, action: "terminal.code", entityType: "TerminalDevice", entityId: t.id, after: { name: t.name }, ip: await clientIp() });
  revalidatePath("/admin/terminals");
  return { code, name: t.name };
}

export async function setTerminalActive(id: string, active: boolean) {
  const { employee: admin } = await requireAdmin();
  const t = await db.terminalDevice.update({ where: { id }, data: { active, ...(active ? {} : { tokenHash: null, activationCodeHash: null }) } });
  await audit({ actorId: admin.id, action: active ? "terminal.activate" : "terminal.deactivate", entityType: "TerminalDevice", entityId: t.id, ip: await clientIp() });
  revalidatePath("/admin/terminals");
}
