/** Hintergrundprüfungen (einmal pro App-Instanz): vergessenes Ausstempeln und fällige Austritte alle 10 Minuten, Löschfristen täglich */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_JOBS === "1") return;
  const { checkOpenEntries, applyExits } = await import("./modules/zeiterfassung/warnings");
  const { applyRetention } = await import("./modules/admin/retention");
  let lastRetention = "";
  const run = () => {
    const today = new Date().toISOString().slice(0, 10);
    const daily = today !== lastRetention ? ((lastRetention = today), applyRetention()) : Promise.resolve(0);
    return Promise.all([checkOpenEntries(), applyExits(), daily]).catch((e) => console.error("Hintergrundprüfung fehlgeschlagen", e));
  };
  setTimeout(run, 30_000);
  setInterval(run, 10 * 60_000);
}
