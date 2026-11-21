/**
 * Reine Rechenlogik der Zeiterfassung (ohne Datenbank) – vollständig unit-getestet.
 *
 * Begriffe:
 * - Eintrag (Entry): Intervall ARBEIT oder PAUSE mit start/end (end = null → läuft noch)
 * - Arbeitstag: Kalendertag (Europe/Berlin). Es gibt keine Nachtschichten – eine über
 *   Mitternacht offene Buchung gilt als „vergessen auszustempeln“.
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

// ───────────────────────── Pausen ─────────────────────────

/** Pausen gelten nach §4 ArbZG erst ab 15 Minuten am Stück */
export const MIN_BREAK_BLOCK = 15;

/**
 * Pausenregel: gesetzlich (§4 ArbZG) oder betrieblich (z. B. 45 Min. ab 6 Std.).
 * Die betriebliche Regel gilt zusätzlich – nie weniger als gesetzlich.
 */
export type BreakRule = { kind: "gesetzlich" } | { kind: "betrieblich"; afterMinutes: number; breakMinutes: number };
export const LEGAL_BREAK_RULE: BreakRule = { kind: "gesetzlich" };

/** Mindestpause für eine Arbeitszeit (Minuten, ohne Pausen) */
export function requiredBreak(workMinutes: number, rule: BreakRule = LEGAL_BREAK_RULE): number {
  const legal = workMinutes > 9 * 60 ? 45 : workMinutes > 6 * 60 ? 30 : 0;
  if (rule.kind === "betrieblich" && workMinutes > rule.afterMinutes) return Math.max(legal, rule.breakMinutes);
  return legal;
}

/**
 * Kleinster Abzug d, sodass (anrechenbare Pause + d) die Mindestpause für (Arbeitszeit − d) erfüllt.
 * Gesetzlich: 6:10 Std. ohne Pause → Abzug 10 Min. (danach 6:00 Std., keine Pause nötig);
 * 7:00 Std. ohne Pause → Abzug 30 Min.; 9:20 Std. mit 30 Min. Pause → Abzug 15 Min.
 */
export function breakDeduction(workMinutes: number, qualifyingBreak: number, rule: BreakRule = LEGAL_BREAK_RULE): number {
  const max = Math.max(45, rule.kind === "betrieblich" ? rule.breakMinutes : 0);
  for (let d = 0; d <= max; d++) {
    if (qualifyingBreak + d >= requiredBreak(workMinutes - d, rule)) return d;
  }
  return max;
}

// ───────────────────────── Tageszusammenfassung ─────────────────────────

export interface DaySummary {
  /** tatsächliche Arbeitszeit (Summe ARBEIT-Intervalle) – maßgeblich für ArbZG-Prüfungen */
  workMinutes: number;
  /** Arbeitszeit vor dem Anrechnungsbeginn (z. B. vor 6:00) – wird nicht gutgeschrieben */
  notCreditedMinutes: number;
  /** gestempelte Pausen + Lücken zwischen Arbeitsblöcken */
  breakMinutes: number;
  /** davon anrechenbar (Blöcke ≥ 15 Min.) */
  qualifyingBreakMinutes: number;
  requiredBreakMinutes: number;
  /** fehlende Pause in Minuten (0 = in Ordnung) */
  missingBreakMinutes: number;
  /** abgezogene Minuten für nicht gestempelte Pause (nur Modus "abzug") */
  deductedMinutes: number;
  /** gutgeschriebene Arbeitszeit = Arbeitszeit − vor Anrechnungsbeginn − Pausenabzug */
  netWorkMinutes: number;
  firstStart: Date | null;
  lastEnd: Date | null;
  /** läuft gerade ein Eintrag? */
  open: boolean;
}

const minutesBetween = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / 60_000);

export interface SummaryOptions {
  now?: Date;
  /** "abzug" (Standard): fehlende Pause wird abgezogen; "hinweis": nur markieren */
  mode?: "hinweis" | "abzug";
  breakRule?: BreakRule;
  /** Zeitpunkt, ab dem Arbeitszeit gutgeschrieben wird (z. B. 6:00 Uhr dieses Tages) */
  creditFrom?: Date | null;
}

/**
 * Fasst die Einträge EINES Arbeitstages zusammen. Offene Einträge zählen bis `now`.
 * Minuten werden sekundengenau summiert und erst am Ende abgerundet.
 */
export function summarizeDay(entries: EntryLike[], opts: SummaryOptions = {}): DaySummary {
  const now = opts.now ?? new Date();
  const mode = opts.mode ?? "abzug";
  const rule = opts.breakRule ?? LEGAL_BREAK_RULE;
  const sorted = [...entries].sort((a, b) => a.start.getTime() - b.start.getTime());

  let work = 0;
  let notCredited = 0;
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
      // Lücke zwischen zwei Arbeitsblöcken (z. B. Gehen → Kommen) zählt als Pause
      if (prevWorkEnd && e.start > prevWorkEnd) breaks.push(minutesBetween(prevWorkEnd, e.start));
      work += dur;
      if (opts.creditFrom && e.start < opts.creditFrom) {
        notCredited += minutesBetween(e.start, end < opts.creditFrom ? end : opts.creditFrom);
      }
      firstStart ??= e.start;
      prevWorkEnd = end;
      lastEnd = end;
    } else {
      const from = prevWorkEnd && prevWorkEnd < e.start ? prevWorkEnd : e.start;
      breaks.push(minutesBetween(from, end));
      prevWorkEnd = end;
    }
  }

  const workMinutes = Math.floor(work);
  const notCreditedMinutes = Math.floor(notCredited);
  const breakMinutes = Math.floor(breaks.reduce((a, b) => a + b, 0));
  const qualifyingBreakMinutes = Math.floor(breaks.filter((b) => b >= MIN_BREAK_BLOCK).reduce((a, b) => a + b, 0));
  const requiredBreakMinutes = requiredBreak(workMinutes, rule);
  const missingBreakMinutes = breakDeduction(workMinutes, qualifyingBreakMinutes, rule);
  const deductedMinutes = mode === "abzug" ? missingBreakMinutes : 0;

  return {
    workMinutes,
    notCreditedMinutes,
    breakMinutes,
    qualifyingBreakMinutes,
    requiredBreakMinutes,
    missingBreakMinutes,
    deductedMinutes,
    netWorkMinutes: Math.max(0, workMinutes - notCreditedMinutes - deductedMinutes),
    firstStart,
    lastEnd,
    open,
  };
}

/**
 * Es gibt keine Nachtschichten: Eine Buchung, die an einem früheren Kalendertag
 * begonnen hat und noch offen ist, gilt als „vergessen auszustempeln“.
 */
export function isStale(open: { workDate: Date } | null | undefined, today: Date): boolean {
  return !!open && open.workDate.getTime() < today.getTime();
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
