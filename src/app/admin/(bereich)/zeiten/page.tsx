import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Zeiten" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Zeiten" text="Zeiten korrigieren mit Änderungsprotokoll – folgt in Meilenstein 3." />;
}
