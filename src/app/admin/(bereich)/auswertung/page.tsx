import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Monatsabschluss & Export" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Monatsabschluss & Export" text="Monatsabschluss, PDF-Nachweise und Lohn-Export – folgt in Meilenstein 6." />;
}
