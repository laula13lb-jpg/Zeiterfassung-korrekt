import { requireEmployee } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Meine Abteilung" };

export default async function Page() {
  await requireEmployee();
  return <ComingSoon title="Meine Abteilung" text="Anwesenheit und Anträge Ihrer Abteilung – folgt in Meilenstein 4/5." />;
}
