import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Einstellungen" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Einstellungen" text="Feiertage, Pausenregeln, Rundung, Stempel-Erlaubnis, Mindestbesetzung – folgt in Meilenstein 6." />;
}
