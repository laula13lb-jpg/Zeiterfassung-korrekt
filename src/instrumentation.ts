/** Hintergrundprüfungen (einmal pro App-Instanz): vergessenes Ausstempeln und fällige Austritte alle 10 Minuten */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  const { checkOpenEntries, applyExits } = await import("./modules/zeiterfassung/warnings");
  const run = () =>
    Promise.all([checkOpenEntries(), applyExits()]).catch((e) => console.error("Hintergrundprüfung fehlgeschlagen", e));
  setTimeout(run, 30_000);
  setInterval(run, 10 * 60_000);
}
