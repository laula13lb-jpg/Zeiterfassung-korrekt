import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function Start() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-8 p-6">
      <header className="pt-6">
        <Brand subtitle="Zeiterfassung" />
      </header>
      <div className="flex flex-col gap-4">
        <Link href="/anmelden" className="btn btn-primary min-h-20 text-xl">Anmelden (Mitarbeiter)</Link>
        <Link href="/terminal" className="btn btn-accent min-h-20 text-xl">Werkstatt-Terminal</Link>
        <Link href="/admin/anmelden" className="btn btn-ghost">Verwaltung (Admin)</Link>
      </div>
    </main>
  );
}
