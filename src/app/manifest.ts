import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeiterfassung – Bludau Die Auto-Klinik",
    short_name: "Bludau Zeit",
    description: "Arbeitszeit, Urlaub und Abwesenheiten – Autoklinik Bludau",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "de",
    background_color: "#ffffff",
    theme_color: "#0a3a82",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
