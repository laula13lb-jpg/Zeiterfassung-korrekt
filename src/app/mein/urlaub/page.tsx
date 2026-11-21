import { requireEmployee } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Urlaub" };

export default async function Page() {
  await requireEmployee();
  return <ComingSoon title="Urlaub" text="Urlaubsanträge und Resturlaub – folgt in Meilenstein 4." />;
}
