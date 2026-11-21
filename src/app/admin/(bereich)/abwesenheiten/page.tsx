import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Abwesenheiten" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Abwesenheiten" text="Urlaubs- und Abwesenheitskalender – folgt in Meilenstein 4/5." />;
}
