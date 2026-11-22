/**
 * [AUFTRAEGE] Vorbereitung Modul „Arbeitsaufträge“ – noch nicht in der Oberfläche.
 * Siehe docs/modul-auftraege.md. Datenmodell: Order, OrderPosition, TimeEntry.orderId/orderPositionId/productive.
 */

/** Arbeitsbereiche innerhalb der Abteilung Lack, auf die Lack-AW frei verteilt werden */
export const LACK_WORK_AREAS = ["Vorarbeit", "Lackierung", "Finish"] as const;
export type LackWorkArea = (typeof LACK_WORK_AREAS)[number];

export interface OrderPositionInput {
  departmentId: string;
  workArea?: string | null;
  description: string;
  soldAw: number;
}

export interface ProductiveBooking {
  orderPositionId: string | null;
  departmentId: string | null;
  workArea?: string | null;
  minutes: number;
  productive: boolean;
}

/** Arbeitswerte → Minuten (Standard: 1 AW = 6 Min., also 10 AW = 1 Std.; einstellbar) */
export const awToMinutes = (aw: number, minutesPerAw = 6) => Math.round(aw * minutesPerAw);
export const minutesToAw = (min: number, minutesPerAw = 6) => Math.round((min / minutesPerAw) * 10) / 10;

/**
 * Aufteilung einer Lack-Position auf Arbeitsbereiche (frei pro Auftrag).
 * Prozentwerte müssen 100 ergeben; Rundung auf 0,1 AW, Rest geht an den letzten Bereich.
 */
export function splitAw(totalAw: number, shares: { workArea: string; percent: number }[]): { workArea: string; aw: number }[] | string {
  const sum = shares.reduce((s, x) => s + x.percent, 0);
  if (Math.abs(sum - 100) > 0.01) return "Die Anteile müssen zusammen 100 % ergeben.";
  let rest = Math.round(totalAw * 10);
  return shares.map((s, i) => {
    const part = i === shares.length - 1 ? rest : Math.round((totalAw * 10 * s.percent) / 100);
    rest -= part;
    return { workArea: s.workArea, aw: part / 10 };
  });
}

export interface SollIstRow {
  key: string;
  soldAw: number;
  sollMinutes: number;
  istMinutes: number;
  /** Leistungsgrad: verkaufte Zeit / tatsächliche Zeit (1 = genau getroffen, > 1 schneller) */
  efficiency: number | null;
}

/** Soll/Ist pro Abteilung bzw. Arbeitsbereich: verkaufte AW vs. produktive Zeit */
export function sollIst(positions: (OrderPositionInput & { id: string })[], bookings: ProductiveBooking[], minutesPerAw = 6): SollIstRow[] {
  const keyOf = (dept: string | null, area?: string | null) => `${dept ?? "?"}${area ? `/${area}` : ""}`;
  const rows = new Map<string, SollIstRow>();
  const get = (k: string) => rows.get(k) ?? rows.set(k, { key: k, soldAw: 0, sollMinutes: 0, istMinutes: 0, efficiency: null }).get(k)!;
  for (const p of positions) {
    const r = get(keyOf(p.departmentId, p.workArea));
    r.soldAw += p.soldAw;
    r.sollMinutes += awToMinutes(p.soldAw, minutesPerAw);
  }
  const posById = new Map(positions.map((p) => [p.id, p]));
  for (const b of bookings.filter((x) => x.productive)) {
    const p = b.orderPositionId ? posById.get(b.orderPositionId) : undefined;
    get(keyOf(p?.departmentId ?? b.departmentId, p?.workArea ?? b.workArea)).istMinutes += b.minutes;
  }
  for (const r of rows.values()) r.efficiency = r.istMinutes > 0 ? Math.round((r.sollMinutes / r.istMinutes) * 100) / 100 : null;
  return [...rows.values()];
}
