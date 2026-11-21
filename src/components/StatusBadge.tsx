import type { Status } from "@/modules/zeiterfassung/rules";

const MAP: Record<Status, { text: string; cls: string }> = {
  ARBEIT: { text: "Eingestempelt", cls: "bg-green-600 text-white" },
  PAUSE: { text: "In Pause", cls: "bg-gelb-500 text-blau-950" },
  ABWESEND: { text: "Nicht eingestempelt", cls: "bg-blau-100 text-blau-900" },
};

export function StatusBadge({ status }: { status: Status }) {
  const m = MAP[status];
  return <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-base font-bold ${m.cls}`}>{m.text}</span>;
}
