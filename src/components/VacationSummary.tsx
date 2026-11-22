import type { VacationOverview } from "@/modules/abwesenheit/vacation";

const n = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function VacationSummary({ ov }: { ov: VacationOverview }) {
  const b = ov.balance;
  const items: [string, string][] = [
    [`Anspruch ${b.year}`, n(b.entitlement)],
    [`Übertrag aus ${b.year - 1}`, n(b.carryIn)],
    ["Genehmigt / genommen", n(b.taken)],
    ["Beantragt (offen)", n(ov.pending)],
  ];
  if (b.expired) items.push(["Verfallen", n(b.expired)]);
  return (
    <div className="flex flex-col gap-3">
      {ov.expiryWarning && (
        <p role="note" className="rounded-xl bg-gelb-100 p-3 font-semibold ring-2 ring-gelb-500">{ov.expiryWarning}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map(([l, v]) => (
          <div key={l} className="rounded-xl bg-white p-3 ring-1 ring-blau-900/10">
            <div className="text-sm font-semibold text-blau-800">{l}</div>
            <div className="text-2xl font-black tabular-nums">{v}</div>
          </div>
        ))}
        <div className="rounded-xl bg-blau-800 p-3 text-white" data-testid="resturlaub">
          <div className="text-sm font-semibold text-gelb-400">Resturlaub</div>
          <div className="text-2xl font-black tabular-nums">{n(b.remaining)} <span className="text-base">Tage</span></div>
          {ov.pending > 0 && <div className="text-xs">nach offenen Anträgen: {n(ov.available)}</div>}
        </div>
      </div>
    </div>
  );
}
