/**
 * Einfaches Rate-Limit im Arbeitsspeicher (eine App-Instanz).
 * Zählt Fehlversuche pro Schlüssel (z. B. "pin:<ip>") in einem Zeitfenster.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function isRateLimited(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return false;
  return b.count >= max;
}

export function registerFailure(key: string, windowMs: number, now = Date.now()): void {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count++;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export const LIMITS = {
  /** Fehlversuche PIN pro IP (Terminal teilt sich eine IP → großzügig) */
  pinPerIp: { max: 25, windowMs: 10 * 60_000 },
  /** Fehlversuche Admin-Passwort/TOTP pro IP */
  adminPerIp: { max: 10, windowMs: 15 * 60_000 },
};
