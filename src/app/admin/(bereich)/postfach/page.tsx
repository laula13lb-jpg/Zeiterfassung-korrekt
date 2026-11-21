import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Anträge" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Anträge" text="Genehmigungs-Postfach – folgt in Meilenstein 3/4." />;
}
