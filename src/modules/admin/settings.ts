import { db } from "@/lib/db";

/**
 * Typisierte App-Einstellungen mit Standardwerten.
 * Gespeichert als JSON in AppSetting; fehlende Werte → Standard.
 */
export interface Settings {
  /** Stempeln erlaubt von: Terminal immer; zusätzlich persönliche Geräte? */
  stampFromPersonalDevices: boolean;
  /** Wenn gesetzt: persönliches Stempeln nur aus diesen IP-Bereichen (CIDR), z. B. Firmen-WLAN */
  stampAllowedIpRanges: string[];
  /** Fehlende Pause nach §4 ArbZG: "hinweis" = nur markieren, "abzug" = automatisch abziehen (gekennzeichnet) */
  missingBreakMode: "hinweis" | "abzug";
  /** Rundung in Minuten (0 = keine) */
  roundingMinutes: number;
  /** Uhrzeit, ab der eine offene Buchung als „vergessen auszustempeln“ gilt */
  forgotClockOutTime: string;
  /** Standard-Urlaubsanspruch (Tage/Jahr bei 5-Tage-Woche) */
  defaultVacationDays: number;
  /** Verfall Resturlaub Vorjahr (MM-TT) */
  carryOverExpiry: string;
  /** Hinweis auf verfallenden Urlaub so viele Tage vorher */
  carryOverWarnDays: number;
  /** Kollegen sehen bei Abwesenheit nur „abwesend“ */
  hideAbsenceReasonForColleagues: boolean;
  /** Ampelkonto-Grenzen in Stunden (Hinweis an Admin) */
  balanceYellowHours: number;
  balanceRedHours: number;
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
  missingBreakMode: "hinweis",
  roundingMinutes: 0,
  forgotClockOutTime: "22:00",
  defaultVacationDays: 30,
  carryOverExpiry: "03-31",
  carryOverWarnDays: 60,
  hideAbsenceReasonForColleagues: true,
  balanceYellowHours: 20,
  balanceRedHours: 40,
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
