import { requireEmployee } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Krankmeldung" };

export default async function Page() {
  await requireEmployee();
  return <ComingSoon title="Krankmeldung" text="Krankmeldung erfassen – folgt in Meilenstein 5." />;
}
