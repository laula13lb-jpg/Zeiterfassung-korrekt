/** Schriftzug ohne externe Ressourcen */
export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-gelb-500 text-xl font-black text-blau-900">
        B
      </div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold tracking-tight">Autoklinik Bludau</div>
        {subtitle && <div className="text-sm font-medium opacity-80">{subtitle}</div>}
      </div>
    </div>
  );
}
