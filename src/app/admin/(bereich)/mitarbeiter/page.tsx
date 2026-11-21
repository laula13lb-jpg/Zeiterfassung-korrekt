import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Mitarbeiter" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Mitarbeiter" text="Mitarbeiterverwaltung – folgt in Meilenstein 3/6." />;
}
