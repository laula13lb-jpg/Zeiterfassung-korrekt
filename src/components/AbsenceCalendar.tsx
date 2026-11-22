import { dayKey, berlinDay } from "@/lib/time";
import { holidayName } from "@/modules/zeiterfassung/holidays";
import type { CalendarRow } from "@/modules/abwesenheit/absence-data";

const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** Monatskalender: Zeilen = Personen, Spalten = Tage */
export function AbsenceCalendar({ rows, year, month }: { rows: CalendarRow[]; year: number; month: number }) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: last }, (_, i) => new Date(Date.UTC(year, month - 1, i + 1)));
  const today = dayKey(berlinDay());
  let lastDept = "";
  return (
    <div className="card min-w-0 max-w-full overflow-x-auto p-0">
      <table className="border-collapse text-sm" aria-label="Abwesenheitskalender">
        <thead>
          <tr className="bg-blau-800 text-white">
            <th className="sticky left-0 z-10 min-w-36 bg-blau-800 px-2 py-1 text-left">Name</th>
            {days.map((d) => (
              <th key={d.getTime()} className={`w-8 min-w-8 px-0 py-1 text-center font-semibold ${dayKey(d) === today ? "bg-gelb-500 text-blau-950" : ""}`}>
                <div className="text-[10px] opacity-80">{WD[d.getUTCDay()]}</div>{d.getUTCDate()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const header = r.department !== lastDept;
            lastDept = r.department;
            return [
              header && (
                <tr key={`h-${r.department}-${r.employeeId}`}><td colSpan={days.length + 1} className="bg-blau-50 px-2 py-1 text-xs font-bold uppercase text-blau-800">{r.department}</td></tr>
              ),
              <tr key={r.employeeId} className="border-b border-blau-100">
                <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-semibold whitespace-nowrap">{r.name}</th>
                {days.map((d) => {
                  const k = dayKey(d);
                  const c = r.cells[k];
                  const off = d.getUTCDay() === 0 || d.getUTCDay() === 6 || !!holidayName(k);
                  return (
                    <td key={k} title={c ? `${r.name}: ${c.label}` : holidayName(k) ?? undefined}
                      className={`h-8 border-l border-blau-100 p-0 text-center text-xs font-bold ${off ? "bg-blau-100/60" : ""}`}>
                      {c && (
                        <span className={`mx-auto grid h-6 w-6 place-items-center rounded text-white ${c.pending ? "opacity-50 outline-2 outline-dashed outline-blau-900" : ""}`} style={{ background: c.color }}>
                          {c.short}<span className="sr-only"> {c.label}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CalendarLegend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-3 text-sm">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1"><span aria-hidden className="h-4 w-4 rounded" style={{ background: i.color }} />{i.name}</li>
      ))}
      <li className="flex items-center gap-1"><span aria-hidden className="h-4 w-4 rounded bg-blau-900 opacity-50 outline-2 outline-dashed" />beantragt</li>
    </ul>
  );
}
