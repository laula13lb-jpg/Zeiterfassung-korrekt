import { requireAdmin } from "@/modules/auth/guards";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Aufträge" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Aufträge" text="Modul Arbeitsaufträge (Audatex Carisma, AW-Soll/Ist pro Abteilung und Arbeitsbereich) – in Vorbereitung. Datenmodell und Schnittstellen sind bereits vorgesehen (docs/modul-auftraege.md)." />;
}
