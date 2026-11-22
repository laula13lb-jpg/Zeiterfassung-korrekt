import { test } from "@playwright/test";
import { adminSession, enterPin, expect, formAlert, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht"));

function prevMonth() {
  const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth() - 1, 1));
  return { ym: d.toISOString().slice(0, 7), last: new Date(Date.UTC(n.getFullYear(), n.getMonth(), 0)) };
}

test("Mitarbeiter anlegen → erster Login mit Start-PIN → sperren, entsperren, Austritt", async ({ page, browser }) => {
  await adminSession(page);
  await page.goto("/admin/mitarbeiter/neu");
  await page.getByLabel("Personalnummer").fill("2001");
  await page.getByLabel("Vorname").fill("Erika");
  await page.getByLabel("Nachname").fill("Muster");
  await page.getByLabel("Eintritt").fill(`${new Date().getFullYear()}-01-01`);
  await page.getByRole("combobox", { name: /^Abteilung/ }).selectOption({ label: "Lack" });
  await page.getByRole("button", { name: "Mitarbeiter anlegen" }).click();
  await expect(page.getByTestId("zugangsdaten")).toBeVisible();
  const pin = (await page.getByTestId("start-pin").innerText()).trim();
  expect(pin).toMatch(/^\d{4}$/);
  await page.getByRole("link", { name: /Weiter zu Details/ }).click();
  await expect(page.getByRole("row", { name: /gültig ab|\d\d\.\d\d\.\d{4}/ }).last()).toContainText("39:00");

  // erster Login
  const ctx = await browser.newContext({ ...test.info().project.use });
  const emp = await ctx.newPage();
  await loginEmployee(emp, "Erika Muster", pin);
  await expect(emp).toHaveURL(/pin-aendern/);
  await emp.getByLabel("Bisherige PIN").fill(pin);
  await emp.getByLabel("Neue PIN", { exact: true }).fill("7391");
  await emp.getByLabel("Neue PIN wiederholen").fill("7391");
  await emp.getByRole("button", { name: "PIN speichern" }).click();
  await expect(emp).toHaveURL(/\/mein$/);

  // sperren → Sitzung beendet, Anmeldung nicht möglich
  await page.getByRole("button", { name: "Zugang sperren" }).click();
  await expect(page.getByText(/Gesperrt\. Anmeldung und Stempeln/)).toBeVisible();
  await emp.goto("/mein");
  await expect(emp).toHaveURL(/\/anmelden$/);
  await expect(emp.getByRole("button", { name: "Erika Muster" })).toHaveCount(0);
  await emp.getByRole("button", { name: "Mit Personalnummer anmelden" }).click();
  await emp.getByLabel("Personalnummer").fill("2001");
  await enterPin(emp, "7391");
  await emp.getByRole("button", { name: "Anmelden" }).click();
  await expect(formAlert(emp)).toContainText("nicht möglich");

  await page.reload();
  await page.getByRole("button", { name: "Entsperren" }).click();
  await expect(page.getByText("Entsperrt.")).toBeVisible();

  // Abteilungsleiter-Rolle vergeben
  await page.reload();
  await page.getByLabel("Abteilungsleiter", { exact: true }).check();
  await page.getByLabel("leitet Lack").check();
  await page.getByRole("button", { name: "Stammdaten speichern" }).click();
  await expect(page.getByText("Gespeichert.").first()).toBeVisible();

  // Austritt in der Vergangenheit → ausgetreten, Daten bleiben
  await page.reload();
  await page.getByLabel("Austritt zum").fill(prevMonth().last.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Austritt eintragen" }).click();
  await expect(page.getByText(/Ausgetreten\. Die Daten bleiben/)).toBeVisible();
  await page.goto("/admin/mitarbeiter");
  await expect(page.getByRole("row", { name: /Muster, Erika/ })).toHaveCount(0);
  await page.getByRole("link", { name: "auch ausgetretene zeigen" }).click();
  await expect(page.getByRole("row", { name: /Muster, Erika/ })).toContainText("ausgetreten");
  await ctx.close();
});

test("Letzter Admin kann sich nicht selbst entmachten", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/mitarbeiter");
  await page.getByRole("row", { name: /Bludau, Sabine/ }).getByRole("link", { name: "Details" }).click();
  await page.getByLabel("Admin (Verwaltung)").uncheck();
  await page.getByRole("button", { name: "Stammdaten speichern" }).click();
  await expect(formAlert(page).first()).toContainText("nicht selbst entziehen");
});

test("Anwesenheitstafel", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/anwesenheit");
  await expect(page.getByRole("heading", { name: "Lack" })).toBeVisible();
  await expect(page.getByTestId("anwesenheit").filter({ hasText: "Thomas Krüger" })).toBeVisible();
});

test("Monatsabschluss → Sperre für Änderungen → Bestätigung durch Mitarbeiter → Wiedereröffnung", async ({ page, browser }) => {
  const { ym, last } = prevMonth();
  await adminSession(page);
  await page.goto(`/admin/auswertung?monat=${ym}`);
  await page.getByRole("button", { name: /Alle \d+ offenen Monatsnachweise abschließen/ }).click();
  await expect(page.getByRole("button", { name: /offenen Monatsnachweise abschließen/ })).toHaveCount(0, { timeout: 15000 });
  const row = page.getByTestId("abschluss-zeile").filter({ hasText: "Becker, Max" });
  await expect(row).toContainText("✔");

  // Änderung im abgeschlossenen Monat wird abgelehnt
  const max = await page.request.get("/admin/zeiten");
  expect(max.ok()).toBeTruthy();
  await page.goto("/admin/zeiten");
  await page.getByLabel("Mitarbeiter").selectOption({ label: "Becker, Max (1003)" });
  await page.getByRole("button", { name: "Anzeigen" }).click();
  const lastKey = last.toISOString().slice(0, 10);
  await page.goto(page.url().replace(/\/admin\/zeiten.*$/, "") + `/admin/zeiten/${new URL(page.url()).searchParams.get("mitarbeiter")}/${lastKey}`);
  await page.getByRole("button", { name: "+ Zeile hinzufügen" }).click();
  const rowEl = page.getByTestId("block-zeile").last();
  await rowEl.getByLabel(/von Zeile/).fill("08:00");
  await rowEl.getByLabel(/bis Zeile/).fill("12:00");
  await page.getByLabel("Begründung (Pflicht)").fill("Test nach Abschluss");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(formAlert(page)).toContainText("abgeschlossen");

  // Mitarbeiter bestätigt
  const emp = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await loginEmployee(emp, "Max Becker");
  await expect(emp.getByText(/Monatsnachweis .* bitte prüfen und bestätigen/)).toBeVisible();
  await emp.goto(`/mein/zeiten?monat=${ym}`);
  await expect(emp.getByText(/Monat abgeschlossen am/)).toBeVisible();
  await emp.getByRole("button", { name: "Ja, Monatsnachweis bestätigen" }).click();
  await expect(emp.getByText(/Von dir bestätigt am/)).toBeVisible();
  // eigener PDF-Nachweis ja, fremder nein, Lohnliste nein
  const own = await emp.request.get(`/api/export/monatsnachweis?monat=${ym}`);
  expect(own.headers()["content-type"]).toBe("application/pdf");
  expect((await own.body()).subarray(0, 4).toString()).toBe("%PDF");
  const other = await emp.request.get(`/api/export/monatsnachweis?monat=${ym}&mitarbeiter=irgendwer`);
  expect(other.status()).toBe(403);
  expect((await emp.request.get(`/api/export/lohn?monat=${ym}`)).status()).toBe(403);

  await page.goto(`/admin/auswertung?monat=${ym}`);
  await expect(row).toContainText("bestätigt");
  await row.getByRole("button", { name: "wieder öffnen" }).click();
  await row.getByLabel("Begründung Wiedereröffnung").fill("Nachtrag Inventur");
  await row.getByRole("button", { name: "Öffnen" }).click();
  await expect(row).toContainText("abschließen"); // wieder offen
});

test("Exporte: Lohnliste CSV/Excel, PDF, Datenauskunft", async ({ page }) => {
  const { ym } = prevMonth();
  await adminSession(page);
  const csv = await page.request.get(`/api/export/lohn?monat=${ym}`);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text).toContain("Personalnummer;Nachname;Vorname;Abteilung;Monat;Soll (Std.)");
  expect(text).toMatch(/1003;Becker;Max;/);
  const xlsx = await page.request.get(`/api/export/lohn?monat=${ym}&format=xlsx`);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

  await page.goto("/admin/mitarbeiter");
  await page.getByRole("row", { name: /Becker, Max/ }).getByRole("link", { name: "Details" }).click();
  await page.waitForURL(/\/admin\/mitarbeiter\/c[a-z0-9]+$/);
  const id = page.url().split("/").pop();
  const pdf = await page.request.get(`/api/export/monatsnachweis?mitarbeiter=${id}&monat=${ym}`);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const auskunft = await page.request.get(`/api/export/datenauskunft?mitarbeiter=${id}`);
  const json = await auskunft.json();
  expect(json.stammdaten.personnelNo).toBe("1003");
  expect(JSON.stringify(json)).not.toContain("pinHash");
  expect(json.stempelungen.length).toBeGreaterThan(0);
});
