import { requireEmployee } from "@/modules/auth/guards";
import { fmt } from "@/lib/time";

export const metadata = { title: "Heute" };

export default async function MeinStart() {
  const emp = await requireEmployee();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Hallo {emp.firstName}!</h1>
      <p className="text-lg">{fmt(new Date(), "EEEE, d. MMMM yyyy")}</p>
      <div className="card">
        <p className="text-lg">Stempeln, Tagesübersicht und Zeitkonto folgen in Meilenstein 2 und 3.</p>
      </div>
    </div>
  );
}
