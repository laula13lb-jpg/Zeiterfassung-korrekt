import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zeiterfassung – Autoklinik Bludau", template: "%s · Autoklinik Bludau" },
  description: "Arbeitszeiterfassung, Urlaub und Abwesenheiten",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a3a82",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // dynamisches Rendern erzwingen, damit jede Antwort eine eigene CSP-Nonce trägt
  await headers();
  return (
    <html lang="de">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
