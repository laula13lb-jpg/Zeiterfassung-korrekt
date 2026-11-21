/**
 * Tagesblöcke für Korrekturen (reine Logik).
 * Zeiten als "HH:MM" Berliner Ortszeit am Arbeitstag. Keine Nachtschichten: alles am selben Kalendertag.
 */
export interface BlockInput {
  kind: "ARBEIT" | "PAUSE";
  start: string;
  /** leer = läuft noch (nur letzter Arbeitsblock am heutigen Tag) */
  end: string | null;
}

export const parseHm = (s: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
};

export const fmtHm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Prüft Blöcke: Format, Reihenfolge, keine Überschneidung; liefert Fehlermeldung oder null */
export function validateBlocks(blocks: BlockInput[], opts: { allowOpenLast?: boolean } = {}): string | null {
  if (blocks.length === 0) return null; // leerer Tag = alle Buchungen entfernen
  let prevEnd = -1;
  for (const [i, b] of blocks.entries()) {
    const s = parseHm(b.start);
    if (s === null) return `Zeile ${i + 1}: Beginn bitte als HH:MM angeben.`;
    if (b.end === null || b.end === "") {
      if (!(opts.allowOpenLast && i === blocks.length - 1 && b.kind === "ARBEIT")) return `Zeile ${i + 1}: Ende fehlt.`;
    } else {
      const e = parseHm(b.end);
      if (e === null) return `Zeile ${i + 1}: Ende bitte als HH:MM angeben.`;
      if (e <= s) return `Zeile ${i + 1}: Ende muss nach dem Beginn liegen (keine Nachtschichten).`;
    }
    if (s < prevEnd) return `Zeile ${i + 1}: überschneidet sich mit der vorherigen Zeile.`;
    prevEnd = b.end ? parseHm(b.end)! : 24 * 60;
  }
  if (blocks[0]!.kind === "PAUSE" || blocks.at(-1)!.kind === "PAUSE") return "Der Tag muss mit Arbeit beginnen und enden.";
  return null;
}

/** Einfaches Formular (Kommen/Gehen + bis zu n Pausen) → Blöcke */
export function blocksFromSimple(kommen: string, gehen: string, pausen: { von: string; bis: string }[]): BlockInput[] | string {
  const k = parseHm(kommen);
  const g = parseHm(gehen);
  if (k === null) return "Bitte „Kommen“ als HH:MM angeben.";
  if (g === null) return "Bitte „Gehen“ als HH:MM angeben.";
  if (g <= k) return "„Gehen“ muss nach „Kommen“ liegen.";
  const ps = pausen
    .filter((p) => p.von.trim() || p.bis.trim())
    .map((p) => ({ von: parseHm(p.von), bis: parseHm(p.bis) }));
  if (ps.some((p) => p.von === null || p.bis === null)) return "Pausen bitte mit Beginn und Ende als HH:MM angeben.";
  const sorted = (ps as { von: number; bis: number }[]).sort((a, b) => a.von - b.von);
  const blocks: BlockInput[] = [];
  let cur = k;
  for (const p of sorted) {
    if (p.bis <= p.von) return "Pausenende muss nach Pausenbeginn liegen.";
    if (p.von <= cur || p.bis >= g) return "Pausen müssen zwischen Kommen und Gehen liegen und dürfen sich nicht überschneiden.";
    blocks.push({ kind: "ARBEIT", start: fmtHm(cur), end: fmtHm(p.von) });
    blocks.push({ kind: "PAUSE", start: fmtHm(p.von), end: fmtHm(p.bis) });
    cur = p.bis;
  }
  blocks.push({ kind: "ARBEIT", start: fmtHm(cur), end: fmtHm(g) });
  return blocks;
}
