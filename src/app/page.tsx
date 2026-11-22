import Link from "next/link";
import { Logo } from "@/components/Brand";

export default function Start() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-8 p-6">
      <header className="flex flex-col items-center gap-3 pt-6 text-center">
        <Logo height={160} className="shadow-sm ring-1 ring-blau-900/10" />
        <h1 className="text-2xl font-extrabold">Zeiterfassung</h1>
      </header>
      <div className="flex flex-col gap-4">
        <Link href="/anmelden" className="btn btn-primary min-h-20 text-xl">Anmelden (Mitarbeiter)</Link>
        <Link href="/terminal" className="btn btn-accent min-h-20 text-xl">Werkstatt-Terminal</Link>
        <Link href="/admin/anmelden" className="btn btn-ghost">Verwaltung (Admin)</Link>
      </div>
    </main>
  );
}
