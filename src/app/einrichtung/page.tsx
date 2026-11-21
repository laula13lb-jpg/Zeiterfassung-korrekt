import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { setupNeeded } from "@/modules/auth/setup";
import { SetupForm } from "./SetupForm";

export const metadata = { title: "Ersteinrichtung" };

export default async function Einrichtung() {
  if (!(await setupNeeded())) redirect("/admin/anmelden");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-blau-800 p-4 text-white"><Brand subtitle="Ersteinrichtung" /></header>
      <p className="text-lg">Willkommen! Legen Sie jetzt den ersten Admin-Zugang an. Den <b>Einrichtungscode</b> finden Sie in der Datei <code>.env</code> auf dem Server (Zeile <code>SETUP_TOKEN</code>).</p>
      <SetupForm />
    </main>
  );
}
