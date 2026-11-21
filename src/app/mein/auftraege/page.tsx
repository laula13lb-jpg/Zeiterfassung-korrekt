import { requireEmployee } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Aufträge" };

export default async function MeinAuftraege() {
  await requireEmployee();
  return (
    <ComingSoon title="Arbeitsaufträge"
      text="Hier können Sie später Ihre Arbeitsaufträge abarbeiten und Ihre Zeit direkt auf Aufträge buchen. Dieses Modul ist in Vorbereitung." />
  );
}
