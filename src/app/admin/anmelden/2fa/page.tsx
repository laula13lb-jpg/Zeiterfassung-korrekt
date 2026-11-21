import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getSession } from "@/modules/auth/session";
import { TotpForm } from "./TotpForm";

export const metadata = { title: "Bestätigungscode" };

export default async function Admin2fa() {
  const s = await getSession("ADMIN");
  if (!s) redirect("/admin/anmelden");
  if (!s.pending2fa) redirect("/admin");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-blau-800 p-4 text-white"><Brand subtitle="Zwei-Faktor-Anmeldung" /></header>
      <p className="text-lg">Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.</p>
      <TotpForm />
    </main>
  );
}
