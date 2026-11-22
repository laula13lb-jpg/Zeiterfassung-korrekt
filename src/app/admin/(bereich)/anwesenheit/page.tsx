import { requireAdmin } from "@/modules/auth/guards";
import { fmt } from "@/lib/time";
import { presenceBoard } from "@/modules/zeiterfassung/presence";
import { PresenceBoard } from "@/components/PresenceBoard";
import { AutoRefresh } from "@/components/AutoRefresh";

export const metadata = { title: "Anwesenheit" };

export default async function Anwesenheit() {
  await requireAdmin();
  const rows = await presenceBoard({ showSickReason: true });
  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <h1 className="text-3xl font-extrabold">Anwesenheit</h1>
      <p className="text-lg">{fmt(new Date(), "EEEE, d. MMMM yyyy, HH:mm")} Uhr</p>
      <PresenceBoard rows={rows} />
    </div>
  );
}
