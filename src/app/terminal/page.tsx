import { Brand } from "@/components/Brand";

export const metadata = { title: "Terminal" };

export default function Terminal() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-blau-900 p-6 text-white">
      <Brand subtitle="Werkstatt-Terminal" />
      <p className="text-xl">Der Terminal-Modus (Kommen / Pause / Gehen) folgt in Meilenstein 2.</p>
    </main>
  );
}
