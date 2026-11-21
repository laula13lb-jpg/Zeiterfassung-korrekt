import "server-only";
import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

export const TERMINAL_COOKIE = "bz_terminal";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne 0/O, 1/I

/** Freischaltcode im Format XXXX-XXXX */
export function newActivationCode(): string {
  const c = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^(.{4})(.{4})$/, "$1-$2");

/** Das aktuelle Gerät, falls es ein freigeschaltetes Terminal ist */
export async function currentTerminal() {
  const token = (await cookies()).get(TERMINAL_COOKIE)?.value;
  if (!token) return null;
  const t = await db.terminalDevice.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || !t.active) return null;
  if (!t.lastSeenAt || Date.now() - t.lastSeenAt.getTime() > 5 * 60_000) {
    await db.terminalDevice.update({ where: { id: t.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return t;
}

/** Gerät mit Freischaltcode aktivieren → langlebiges Gerätecookie */
export async function activateWithCode(code: string) {
  const hash = sha256(normalizeCode(code));
  const t = await db.terminalDevice.findFirst({
    where: { activationCodeHash: hash, active: true, activationExpiresAt: { gt: new Date() } },
  });
  if (!t) return null;
  const token = randomToken();
  await db.terminalDevice.update({
    where: { id: t.id },
    data: { tokenHash: sha256(token), activationCodeHash: null, activationExpiresAt: null, lastSeenAt: new Date() },
  });
  (await cookies()).set(TERMINAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "strict",
    path: "/",
    maxAge: 5 * 365 * 24 * 3600,
  });
  return t;
}
