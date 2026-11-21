import { requireAdmin } from "@/modules/auth/guards";
import { openCorrectionRequests } from "@/modules/zeiterfassung/inbox";
import { decideCorrectionAdmin } from "@/modules/zeiterfassung/correction-actions";
import { CorrectionRequestList } from "@/components/CorrectionRequestList";

export const metadata = { title: "Anträge" };

export default async function Postfach() {
  await requireAdmin();
  const requests = await openCorrectionRequests();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Anträge</h1>
      <h2 className="text-xl font-bold">Korrekturanträge</h2>
      <CorrectionRequestList requests={requests} action={decideCorrectionAdmin} />
      <p className="text-sm">Urlaubsanträge folgen in Meilenstein 4.</p>
    </div>
  );
}
