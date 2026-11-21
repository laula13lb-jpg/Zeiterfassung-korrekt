/** Hintergrundprüfungen (einmal pro App-Instanz): vergessenes Ausstempeln alle 10 Minuten */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  const { checkOpenEntries } = await import("./modules/zeiterfassung/warnings");
  const run = () => checkOpenEntries().catch((e) => console.error("Prüfung offener Buchungen fehlgeschlagen", e));
  setTimeout(run, 30_000);
  setInterval(run, 10 * 60_000);
}
