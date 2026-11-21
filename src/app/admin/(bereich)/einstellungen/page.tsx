import { requireAdmin } from "@/modules/auth/guards";
import { getSettings } from "@/modules/admin/settings";
import { StampSettingsForm } from "./StampSettingsForm";

export const metadata = { title: "Einstellungen" };

export default async function Einstellungen() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Einstellungen</h1>
      <StampSettingsForm s={s} />
      <p className="text-sm">Weitere Einstellungen (Feiertage, Rundung, Mindestbesetzung, Abwesenheitsarten) folgen in den nächsten Meilensteinen.</p>
    </div>
  );
}
