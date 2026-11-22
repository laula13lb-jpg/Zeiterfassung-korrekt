import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/guards";
import { getSettings } from "@/modules/admin/settings";
import { StampSettingsForm } from "./StampSettingsForm";
import { RoundingForm } from "./RoundingForm";
import { AbsenceTypes, MinStaffingForm, PrivacySettingsForm, VacationSettingsForm } from "./AbsenceSettings";

export const metadata = { title: "Einstellungen" };

export default async function Einstellungen() {
  await requireAdmin();
  const [s, types, depts] = await Promise.all([
    getSettings(),
    db.absenceType.findMany({ orderBy: [{ system: "desc" }, { name: "asc" }] }),
    db.department.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Einstellungen</h1>
      <StampSettingsForm s={s} />
      <RoundingForm value={s.roundingMinutes} />
      <VacationSettingsForm s={s} />
      <MinStaffingForm depts={depts} />
      <AbsenceTypes types={types} />
      <PrivacySettingsForm s={s} />
      <p className="text-sm">Feiertage und Betriebstage: Menüpunkt „Feiertage“.</p>
    </div>
  );
}
