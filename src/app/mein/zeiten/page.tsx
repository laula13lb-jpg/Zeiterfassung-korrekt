import { requireEmployee } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Meine Zeiten" };

export default async function Page() {
  await requireEmployee();
  return <ComingSoon title="Meine Zeiten" text="Tages-, Wochen- und Monatsübersicht mit Zeitkonto – folgt in Meilenstein 3." />;
}
