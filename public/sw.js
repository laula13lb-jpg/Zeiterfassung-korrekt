/* Service Worker – Zeiterfassung Autoklinik Bludau
 * - Statische Dateien (JS/CSS/Logo/Icons): Cache zuerst
 * - Seiten: immer vom Server (aktuelle Daten); nur das Werkstatt-Terminal wird für
 *   Netzausfälle zwischengespeichert. Andere Seiten mit persönlichen Daten werden NICHT gecacht.
 * - Kein Cache für API, Exporte und Server-Aktionen.
 */
const VERSION = "bz-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline.html", "/logo.jpg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // Server-Aktionen (POST) nie abfangen
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // statische Build-Dateien und Bilder: Cache zuerst
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.jpg") {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate") {
    const isTerminal = url.pathname === "/terminal";
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (isTerminal && res.ok) caches.open(PAGES).then((c) => c.put("/terminal", res.clone()));
          return res;
        })
        .catch(async () => (isTerminal && (await caches.match("/terminal"))) || caches.match("/offline.html")),
    );
  }
});
