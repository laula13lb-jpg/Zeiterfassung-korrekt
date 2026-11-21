/**
 * Reine Rechenlogik der Zeiterfassung (ohne Datenbank) – vollständig unit-getestet.
 *
 * Begriffe:
 * - Eintrag (Entry): Intervall ARBEIT oder PAUSE mit start/end (end = null → läuft noch)
 * - Arbeitstag: Kalendertag (Europe/Berlin) des Beginns. Schichten über Mitternacht
 *   zählen vollständig zum Tag, an dem sie begonnen haben.
 */

export type StampType = "KOMMEN" | "PAUSE_START" | "PAUSE_ENDE" | "GEHEN";
export type Status = "ABWESEND" | "ARBEIT" | "PAUSE";

export interface EntryLike {
  kind: "ARBEIT" | "PAUSE";
  start: Date;
  end: Date | null;
}

export const STAMP_LABEL: Record<StampType, string> = {
  KOMMEN: "Kommen",
  PAUSE_START: "Pause",
  PAUSE_ENDE: "Pause Ende",
  GEHEN: "Gehen",
};

/** Status aus dem (höchstens einen) offenen Eintrag */
export function statusFromOpen(open: Pick<EntryLike, "kind"> | null | undefined): Status {
  if (!open) return "ABWESEND";
  return open.kind === "PAUSE" ? "PAUSE" : "ARBEIT";
}

/** Welche Stempelungen sind im aktuellen Status erlaubt? */
export function allowedStamps(status: Status): StampType[] {
  switch (status) {
    case "ABWESEND":
      return ["KOMMEN"];
    case "ARBEIT":
      return ["PAUSE_START", "GEHEN"];
    case "PAUSE":
      return ["PAUSE_ENDE", "GEHEN"];
  }
}

/** Status nach einer Stempelung */
export function nextStatus(type: StampType): Status {
  return type === "GEHEN" ? "ABWESEND" : type === "PAUSE_START" ? "PAUSE" : "ARBEIT";
}

/**
 * Planung der Datenbank-Änderungen für eine Stempelung:
 * offenen Eintrag schließen und ggf. neuen öffnen.
 */
export function planStamp(status: Status, type: StampType): { close: boolean; open: "ARBEIT" | "PAUSE" | null } | { error: string } {
  if (!allowedStamps(status).includes(type)) {
    const msg: Record<Status, string> = {
      ABWESEND: "Du bist nicht eingestempelt. Bitte zuerst „Kommen“ drücken.",
      ARBEIT: "Du bist bereits eingestempelt.",
      PAUSE: "Du bist gerade in der Pause. Bitte „Pause Ende“ oder „Gehen“ drücken.",
    };
    return { error: msg[status] };
  }
  switch (type) {
    case "KOMMEN":
      return { close: false, open: "ARBEIT" };
    case "PAUSE_START":
      return { close: true, open: "PAUSE" };
    case "PAUSE_ENDE":
      return { close: true, open: "ARBEIT" };
    case "GEHEN":
      return { close: true, open: null };
  }
}

// ───────────────────────── Pausen nach §4 ArbZG ─────────────────────────

/** Pausen gelten nach §4 ArbZG erst ab 15 Minuten am Stück */
export const MIN_BREAK_BLOCK = 15;

/** Gesetzliche Mindestpause für eine Arbeitszeit (Minuten, ohne Pausen) */
export function requiredBreak(workMinutes: number): number {
  if (workMinutes > 9 * 60) return 45;
  if (workMinutes > 6 * 60) return 30;
  return 0;
}

/**
 * Kleinster Abzug d, sodass (anrechenbare Pause + d) die Mindestpause für (Arbeitszeit − d) erfüllt.
 * Beispiel: 6:10 Std. ohne Pause → Abzug 10 Min. (danach 6:00 Std., keine Pause nötig);
 * 7:00 Std. ohne Pause → Abzug 30 Min.; 9:20 Std. mit 30 Min. Pause → Abzug 15 Min.
 */
export function breakDeduction(workMinutes: number, qualifyingBreak: number): number {
  for (let d = 0; d <= 45; d++) {
    if (qualifyingBreak + d >= requiredBreak(workMinutes - d)) return d;
  }
  return 45;
}

// ───────────────────────── Tageszusammenfassung ─────────────────────────

export interface DaySummary {
  /** Brutto-Arbeitszeit (Summe ARBEIT-Intervalle) */
  workMinutes: number;
  /** gestempelte Pausen + Lücken zwischen Arbeitsblöcken */
  breakMinutes: number;
  /** davon nach §4 anrechenbar (Blöcke ≥ 15 Min.) */
  qualifyingBreakMinutes: number;
  requiredBreakMinutes: number;
  /** fehlende Pause in Minuten (0 = in Ordnung) */
  missingBreakMinutes: number;
  /** tatsächlich abgezogene Minuten (nur bei Modus "abzug") */
  deductedMinutes: number;
  /** angerechnete Arbeitszeit (nach evtl. Abzug) */
  netWorkMinutes: number;
  firstStart: Date | null;
  lastEnd: Date | null;
  /** läuft gerade ein Eintrag? */
  open: boolean;
}

const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60_000);

/**
 * Fasst die Einträge EINES Arbeitstages zusammen. Offene Einträge zählen bis `now`.
 * Minuten werden sekundengenau summiert und erst am Ende abgerundet.
 */
export function summarizeDay(entries: EntryLike[], opts: { now?: Date; mode?: "hinweis" | "abzug" } = {}): DaySummary {
  const now = opts.now ?? new Date();
  const sorted = [...entries].sort((a, b) => a.start.getTime() - b.start.getTime());

  let work = 0;
  const breaks: number[] = [];
  let firstStart: Date | null = null;
  let lastEnd: Date | null = null;
  let open = false;
  let prevWorkEnd: Date | null = null;

  for (const e of sorted) {
    const end = e.end ?? now;
    if (!e.end) open = true;
    const dur = minutesBetween(e.start, end);
    if (e.kind === "ARBEIT") {
      // Lücke zwischen zwei Arbeitsblöcken (z. B. Gehen → Kommen) zählt als Pause,
      // sofern nicht schon als gestempelte Pause erfasst
      if (prevWorkEnd && e.start > prevWorkEnd) breaks.push(minutesBetween(prevWorkEnd, e.start));
      work += dur;
      firstStart ??= e.start;
      prevWorkEnd = end;
      lastEnd = end;
    } else {
      // gestempelte Pause: Lücke ab Arbeitsende wird von der Pause abgedeckt
      const from = prevWorkEnd && prevWorkEnd < e.start ? prevWorkEnd : e.start;
      breaks.push(minutesBetween(from, end));
      prevWorkEnd = end;
    }
  }

  const workMinutes = Math.floor(work);
  const breakMinutes = Math.floor(breaks.reduce((a, b) => a + b, 0));
  const qualifyingBreakMinutes = Math.floor(breaks.filter((b) => b >= MIN_BREAK_BLOCK).reduce((a, b) => a + b, 0));
  const requiredBreakMinutes = requiredBreak(workMinutes);
  const deduction = breakDeduction(workMinutes, qualifyingBreakMinutes);
  const missingBreakMinutes = deduction;
  const deductedMinutes = opts.mode === "abzug" && !open ? deduction : 0;

  return {
    workMinutes,
    breakMinutes,
    qualifyingBreakMinutes,
    requiredBreakMinutes,
    missingBreakMinutes,
    deductedMinutes,
    netWorkMinutes: workMinutes - deductedMinutes,
    firstStart,
    lastEnd,
    open,
  };
}

/** Ein offener Eintrag gilt als „vergessen auszustempeln“, wenn er älter als maxHours ist */
export function isStale(open: Pick<EntryLike, "start"> | null | undefined, now: Date, maxHours = 16): boolean {
  return !!open && now.getTime() - open.start.getTime() > maxHours * 3600_000;
}

/** Doppeltes Antippen: gleiche Stempelart innerhalb weniger Sekunden */
export function isDuplicate(last: { type: StampType; at: Date } | null | undefined, type: StampType, at: Date, windowSec = 60): boolean {
  return !!last && last.type === type && Math.abs(at.getTime() - last.at.getTime()) < windowSec * 1000;
}

/** Begrüßung passend zur Tageszeit (Berliner Stunde) */
export function greeting(type: StampType, hourBerlin: number): string {
  if (type === "GEHEN") return "Schönen Feierabend";
  if (type === "PAUSE_START") return "Gute Pause";
  if (type === "PAUSE_ENDE") return "Weiter geht's";
  if (hourBerlin < 11) return "Guten Morgen";
  if (hourBerlin < 18) return "Hallo";
  return "Guten Abend";
}
