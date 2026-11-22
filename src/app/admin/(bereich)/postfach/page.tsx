import { requireAdmin } from "@/modules/auth/guards";
import { openCorrectionRequests } from "@/modules/zeiterfassung/inbox";
import { decideCorrectionAdmin } from "@/modules/zeiterfassung/correction-actions";
import { decideAbsenceAdmin } from "@/modules/abwesenheit/absence-actions";
import { openAbsenceRequests } from "@/modules/abwesenheit/inbox";
import { CorrectionRequestList } from "@/components/CorrectionRequestList";
import { AbsenceInbox } from "@/components/AbsenceInbox";

export const metadata = { title: "Anträge" };

export default async function Postfach() {
  await requireAdmin();
  const [corrections, absences] = await Promise.all([openCorrectionRequests(), openAbsenceRequests()]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Anträge</h1>
      <h2 className="text-xl font-bold">Urlaub & Abwesenheit ({absences.length})</h2>
      <AbsenceInbox items={absences} action={decideAbsenceAdmin} />
      <h2 className="text-xl font-bold">Korrekturanträge ({corrections.length})</h2>
      <CorrectionRequestList requests={corrections} action={decideCorrectionAdmin} />
    </div>
  );
}
