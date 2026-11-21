import { requireAdmin } from "@/modules/auth/guards";
import { Brand } from "@/components/Brand";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Passwort ändern" };

export default async function PasswortAendern() {
  const { employee } = await requireAdmin({ allowPasswordChange: true });
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 sm:p-6">
      <header className="rounded-2xl bg-blau-800 p-4 text-white"><Brand subtitle="Passwort ändern" /></header>
      {employee.passwordMustChange && (
        <p className="rounded-xl bg-gelb-100 p-4 font-semibold ring-2 ring-gelb-500">Bitte vergeben Sie jetzt ein eigenes, sicheres Passwort.</p>
      )}
      <PasswordForm />
      <p className="text-sm">Mindestens 12 Zeichen, mit mindestens drei von: Kleinbuchstaben, Großbuchstaben, Ziffern, Sonderzeichen. Tipp: ein Satz wie „Lack-trocknet-um-7!“.</p>
    </main>
  );
}
