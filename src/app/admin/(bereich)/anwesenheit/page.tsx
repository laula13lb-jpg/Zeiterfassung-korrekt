import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Anwesenheit" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Anwesenheit" text="Live-Anwesenheitstafel – folgt in Meilenstein 6." />;
}
