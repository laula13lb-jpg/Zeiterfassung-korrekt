import Link from "next/link";
import { requireEmployee } from "@/modules/auth/guards";
import { berlinDay, dayKey, fmt } from "@/lib/time";
import { currentBlocks } from "@/modules/zeiterfassung/corrections";
import { CorrectionRequestForm } from "./CorrectionRequestForm";

export const metadata = { title: "Korrektur beantragen" };

export default async function Korrektur({ searchParams }: { searchParams: Promise<{ datum?: string }> }) {
  const emp = await requireEmployee();
  const q = (await searchParams).datum;
  const datum = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : dayKey(berlinDay());
  const blocks = await currentBlocks(emp.id, new Date(`${datum}T00:00:00Z`));
  const work = blocks.filter((b) => b.kind === "ARBEIT");
  const pauses = blocks.filter((b) => b.kind === "PAUSE");
  // Lücken zwischen Arbeitsblöcken als Pause vorschlagen
  for (let i = 1; i < work.length; i++) {
    if (work[i - 1]!.end && work[i - 1]!.end !== work[i]!.start && !pauses.some((p) => p.start === work[i - 1]!.end)) {
      pauses.push({ kind: "PAUSE", start: work[i - 1]!.end!, end: work[i]!.start });
    }
  }
  pauses.sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="flex max-w-xl flex-col gap-5">
      <Link href={`/mein/zeiten?monat=${datum.slice(0, 7)}`} className="font-semibold underline">← zurück zu Meine Zeiten</Link>
      <h1 className="text-3xl font-extrabold">Korrektur beantragen</h1>
      <p className="text-lg">{fmt(new Date(`${datum}T12:00:00Z`), "EEEE, d. MMMM yyyy")}</p>
      <p>Trage ein, wie der Tag richtig war. Bisher gebucht: {blocks.length ? blocks.map((b) => `${b.kind === "PAUSE" ? "Pause " : ""}${b.start}–${b.end ?? "…"}`).join(", ") : "nichts"}.</p>
      <CorrectionRequestForm
        datum={datum}
        defaults={{
          kommen: work[0]?.start ?? "",
          gehen: work.at(-1)?.end ?? "",
          p1von: pauses[0]?.start ?? "", p1bis: pauses[0]?.end ?? "",
          p2von: pauses[1]?.start ?? "", p2bis: pauses[1]?.end ?? "",
        }}
      />
    </div>
  );
}
