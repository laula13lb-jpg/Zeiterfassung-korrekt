/** Kontosperre nach Fehlversuchen (reine Logik, testbar) */
export const MAX_FAILED = 5;
export const LOCK_MINUTES = 5;

export interface LockState {
  failedCount: number;
  lockedUntil: Date | null;
}

export function isLocked(state: LockState, now = new Date()): boolean {
  return !!state.lockedUntil && state.lockedUntil > now;
}

/** Neuer Zustand nach einem Fehlversuch */
export function afterFailure(state: LockState, now = new Date()): LockState {
  // abgelaufene Sperre: Zähler neu beginnen
  const base = state.lockedUntil && state.lockedUntil <= now ? 0 : state.failedCount;
  const failedCount = base + 1;
  if (failedCount >= MAX_FAILED) {
    return { failedCount, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { failedCount, lockedUntil: null };
}

export function remainingLockMinutes(state: LockState, now = new Date()): number {
  if (!state.lockedUntil) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 60_000));
}
