import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getSession } from "@/modules/auth/session";
import { AdminLoginForm } from "./AdminLoginForm";
import { setupNeeded } from "@/modules/auth/setup";

export const metadata = { title: "Admin-Anmeldung" };

export default async function AdminAnmelden() {
  const s = await getSession("ADMIN");
  if (s && !s.pending2fa) redirect("/admin");
  if (await setupNeeded()) redirect("/einrichtung");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-blau-800 p-4 text-white"><Brand subtitle="Verwaltung – Anmeldung" /></header>
      <AdminLoginForm />
    </main>
  );
}
