import "server-only";
import { cookies } from "next/headers";
import type { Employee, Session, SessionKind } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { clientIp, userAgent } from "@/lib/request";

/**
 * Sitzungen: zufälliges Token im Cookie, in der DB nur dessen SHA-256.
 * Mitarbeiter- und Admin-Sitzungen sind getrennt (eigene Cookies, eigene Timeouts).
 */
export const SESSION_CONFIG: Record<SessionKind, { cookie: string; idleMs: number; absoluteMs: number }> = {
  // Persönliches Gerät (Firmenhandy): bleibt angemeldet, solange es genutzt wird
  MITARBEITER: { cookie: "bz_sitzung", idleMs: 14 * 24 * 3600_000, absoluteMs: 60 * 24 * 3600_000 },
  // Admin: kurzer Timeout
  ADMIN: { cookie: "bz_admin", idleMs: 30 * 60_000, absoluteMs: 10 * 3600_000 },
};

const secureCookies = () => process.env.COOKIE_SECURE !== "false";

export type SessionWithEmployee = Session & { employee: Employee };

export async function createSession(employeeId: string, kind: SessionKind, opts: { pending2fa?: boolean } = {}) {
  const token = randomToken();
  const cfg = SESSION_CONFIG[kind];
  const now = Date.now();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      employeeId,
      kind,
      pending2fa: opts.pending2fa ?? false,
      expiresAt: new Date(now + cfg.absoluteMs),
      ip: await clientIp(),
      userAgent: await userAgent(),
    },
  });
  (await cookies()).set(cfg.cookie, token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "strict",
    path: "/",
    // Admin-Cookie ohne maxAge → Sitzungscookie (weg beim Schließen des Browsers)
    ...(kind === "MITARBEITER" ? { maxAge: Math.floor(cfg.absoluteMs / 1000) } : {}),
  });
}

/** Aktuelle Sitzung laden und gleitend verlängern; abgelaufene werden gelöscht */
export async function getSession(kind: SessionKind): Promise<SessionWithEmployee | null> {
  const cfg = SESSION_CONFIG[kind];
  const token = (await cookies()).get(cfg.cookie)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { employee: true } });
  if (!s || s.kind !== kind) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() <= now || s.lastActiveAt.getTime() + cfg.idleMs <= now || s.employee.status !== "AKTIV") {
    await db.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  // lastActiveAt höchstens jede Minute schreiben
  if (now - s.lastActiveAt.getTime() > 60_000) {
    await db.session.update({ where: { id: s.id }, data: { lastActiveAt: new Date(now) } }).catch(() => {});
  }
  return s;
}

export async function destroySession(kind: SessionKind) {
  const cfg = SESSION_CONFIG[kind];
  const jar = await cookies();
  const token = jar.get(cfg.cookie)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(cfg.cookie);
}

/** Alle Sitzungen einer Person beenden (z. B. nach PIN-Reset oder Sperre) */
export async function destroyAllSessions(employeeId: string, kind?: SessionKind) {
  await db.session.deleteMany({ where: { employeeId, ...(kind ? { kind } : {}) } });
}

export async function markSession2faDone(sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { pending2fa: false, lastActiveAt: new Date() } });
}
