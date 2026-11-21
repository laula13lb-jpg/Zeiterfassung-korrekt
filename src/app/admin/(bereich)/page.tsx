import Link from "next/link";
import { requireAdmin } from "@/modules/auth/guards";
import { db } from "@/lib/db";
import { getSettings } from "@/modules/admin/settings";

export const metadata = { title: "Verwaltung" };

export default async function AdminStart() {
  const { employee } = await requireAdmin();
  const [active, departments, settings] = await Promise.all([
    db.employee.count({ where: { status: "AKTIV", tracksTime: true } }),
    db.department.count({ where: { active: true } }),
    getSettings(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Übersicht</h1>
      {!employee.totpEnabled && (
        <div className="card border-l-8 border-gelb-500">
          <p className="font-semibold">Empfehlung: Schalten Sie die Zwei-Faktor-Anmeldung (2FA) für Ihren Admin-Zugang ein.</p>
          <Link href="/admin/sicherheit" className="btn btn-primary mt-3">2FA einrichten</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="text-sm font-semibold uppercase text-blau-800">Aktive Mitarbeiter</div><div className="text-4xl font-black">{active}</div></div>
        <div className="card"><div className="text-sm font-semibold uppercase text-blau-800">Abteilungen</div><div className="text-4xl font-black">{departments}</div></div>
        <div className="card"><div className="text-sm font-semibold uppercase text-blau-800">Stempeln vom Handy</div><div className="text-2xl font-black">{settings.stampFromPersonalDevices ? "erlaubt" : "nur Terminal"}</div></div>
      </div>
    </div>
  );
}
