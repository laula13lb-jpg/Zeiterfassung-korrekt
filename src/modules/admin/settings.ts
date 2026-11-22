import { db } from "@/lib/db";
import { berlinTimeOn } from "@/lib/time";
import type { BreakRule } from "@/modules/zeiterfassung/rules";

/**
 * Typisierte App-Einstellungen mit Standardwerten.
 * Gespeichert als JSON in AppSetting; fehlende Werte → Standard.
 */
export interface Settings {
  /** Stempeln erlaubt von: Terminal immer; zusätzlich persönliche Geräte? */
  stampFromPersonalDevices: boolean;
  /** Wenn gesetzt: persönliches Stempeln nur aus diesen IP-Bereichen (CIDR), z. B. Firmen-WLAN */
  stampAllowedIpRanges: string[];
  /** Nicht gestempelte Pause: "abzug" = automatisch abziehen (gekennzeichnet), "hinweis" = nur markieren */
  missingBreakMode: "hinweis" | "abzug";
  /** Pausenregel: gesetzlich (30 Min. ab 6 Std., 45 Min. ab 9 Std.) oder betrieblich */
  breakRule: "gesetzlich" | "betrieblich";
  /** betriebliche Pausenregel: ab so vielen Minuten Arbeit … */
  companyBreakAfterMinutes: number;
  /** … so viele Minuten Pause (nie weniger als gesetzlich) */
  companyBreakMinutes: number;
  /** Arbeitszeit wird erst ab dieser Uhrzeit gutgeschrieben (davor: keine Arbeitszeit/Überstunde), leer = ab Kommen */
  creditFromTime: string;
  /** Rundung in Minuten (0 = keine) */
  roundingMinutes: number;
  /** Uhrzeit, ab der eine offene Buchung als „vergessen auszustempeln“ gilt (Hinweis an Admin) */
  forgotClockOutTime: string;
  /** Standard-Urlaubsanspruch (Tage/Jahr bei 5-Tage-Woche) */
  defaultVacationDays: number;
  /** Resturlaub verfällt zum Stichtag (sonst unbegrenzter Übertrag) */
  vacationExpiry: boolean;
  /** Verfall Resturlaub Vorjahr (MM-TT) */
  carryOverExpiry: string;
  /** Hinweis auf verfallenden Urlaub so viele Tage vorher */
  carryOverWarnDays: number;
  /** Kollegen sehen bei Abwesenheit nur „abwesend“ */
  hideAbsenceReasonForColleagues: boolean;
  /** Ampelkonto-Grenzen in Stunden (Hinweis an Admin) */
  balanceYellowHours: number;
  balanceRedHours: number;
  /** Mitarbeiter bestätigen den abgeschlossenen Monatsnachweis digital */
  monthConfirmation: boolean;
  /** Admins müssen 2FA nutzen */
  requireAdmin2fa: boolean;
  /** Aufbewahrung in Jahren, danach Anonymisierung ausgetretener Mitarbeiter */
  retentionYears: number;
  /** [AUFTRAEGE] Minuten pro Arbeitswert (AW) – häufig 6 (10 AW = 1 Std.) oder 5 */
  minutesPerAw: number;
}

export const DEFAULT_SETTINGS: Settings = {
  stampFromPersonalDevices: false,
  stampAllowedIpRanges: [],
  missingBreakMode: "abzug",
  breakRule: "betrieblich",
  companyBreakAfterMinutes: 360,
  companyBreakMinutes: 45,
  creditFromTime: "06:00",
  roundingMinutes: 0,
  forgotClockOutTime: "22:00",
  defaultVacationDays: 30,
  vacationExpiry: true,
  carryOverExpiry: "03-31",
  carryOverWarnDays: 60,
  hideAbsenceReasonForColleagues: true,
  balanceYellowHours: 20,
  balanceRedHours: 40,
  monthConfirmation: true,
  requireAdmin2fa: false,
  retentionYears: 10,
  minutesPerAw: 6,
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.appSetting.findMany();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) s[r.key] = r.value;
  return s as unknown as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K], by?: string) {
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: value as never, updatedBy: by },
    update: { value: value as never, updatedBy: by },
  });
}

/** Pausenregel aus den Einstellungen */
export function breakRuleOf(s: Settings): BreakRule {
  return s.breakRule === "betrieblich"
    ? { kind: "betrieblich", afterMinutes: s.companyBreakAfterMinutes, breakMinutes: s.companyBreakMinutes }
    : { kind: "gesetzlich" };
}

/** Optionen für die Tageszusammenfassung eines Arbeitstags */
export function summaryOptionsFor(s: Settings, workDate: Date) {
  return {
    mode: s.missingBreakMode,
    breakRule: breakRuleOf(s),
    creditFrom: s.creditFromTime ? berlinTimeOn(workDate, s.creditFromTime) : null,
  };
}
