import { fmtDate, fmtDateTime } from "@/lib/time";
import type { BlockInput } from "@/modules/zeiterfassung/blocks";
import { DecisionForm } from "./DecisionForm";

type Req = {
  id: string; workDate: Date; message: string; createdAt: Date; proposed: unknown;
  employee: { firstName: string; lastName: string; department: { name: string } | null };
  current: BlockInput[];
};
type Act = Parameters<typeof DecisionForm>[0]["action"];

const fmtBlocks = (b: BlockInput[]) => (b.length ? b.map((x) => `${x.kind === "PAUSE" ? "Pause " : ""}${x.start}–${x.end ?? "…"}`).join(", ") : "keine Buchung");

export function CorrectionRequestList({ requests, action }: { requests: Req[]; action: Act }) {
  if (!requests.length) return <p className="card">Keine offenen Korrekturanträge.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {requests.map((r) => (
        <li key={r.id} className="card flex flex-col gap-2" data-testid="korrekturantrag">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-lg">{r.employee.firstName} {r.employee.lastName}</b>
            <span className="text-sm">{r.employee.department?.name} · gestellt {fmtDateTime(r.createdAt)}</span>
          </div>
          <div>Tag: <b>{fmtDate(r.workDate)}</b></div>
          <div>„{r.message}“</div>
          <div className="text-base">Bisher: <span className="line-through">{fmtBlocks(r.current)}</span></div>
          <div className="text-base">Gewünscht: <b>{fmtBlocks(((r.proposed as { blocks?: BlockInput[] })?.blocks ?? []))}</b></div>
          <DecisionForm id={r.id} action={action} />
        </li>
      ))}
    </ul>
  );
}
