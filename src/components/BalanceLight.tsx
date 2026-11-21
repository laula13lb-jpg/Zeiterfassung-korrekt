import { fmtMinutes } from "@/lib/time";

const STYLE = { gruen: "bg-green-600", gelb: "bg-gelb-500", rot: "bg-red-700" } as const;
const TEXT = { gruen: "im Rahmen", gelb: "beobachten", rot: "handeln" } as const;

export function BalanceLight({ minutes, light }: { minutes: number; light: keyof typeof STYLE }) {
  return (
    <span className="inline-flex items-center gap-2 font-bold tabular-nums">
      <span aria-hidden className={`h-4 w-4 rounded-full ${STYLE[light]}`} />
      {minutes > 0 ? "+" : ""}{fmtMinutes(minutes)}
      <span className="sr-only">({TEXT[light]})</span>
    </span>
  );
}
