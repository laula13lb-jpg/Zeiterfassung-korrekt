import { test } from "@playwright/test";
import { adminSession, expect, formAlert, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht"));

/** letzter Werktag vor heute (Berliner Datum) – dort gibt es Beispielzeiten */
function lastWeekday(back = 1): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let n = 0;
  while (n < back) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++;
  }
  return d.toISOString().slice(0, 10);
}

test("Korrekturantrag → Abteilungsleiter genehmigt → Zeiten übernommen", async ({ browser }) => {
  const datum = lastWeekday(2);
  const use = test.info().project.use;

  const emp = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(emp, "Piotr Nowak");
  await emp.goto(`/mein/zeiten/korrektur?datum=${datum}`);
  await expect(emp.getByLabel("Kommen")).toHaveValue(/0[67]:\d\d/);
  await emp.getByLabel("Gehen").fill("17:30");
  await emp.getByLabel("Was war los?").fill("Vergessen auszustempeln, war bis 17:30 da");
  await emp.getByRole("button", { name: "Antrag stellen" }).click();
  await expect(emp.getByText("Antrag gestellt")).toBeVisible();

  // Kollege aus anderer Abteilung ist kein Genehmiger
  const other = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(other, "Max Becker");
  await other.goto("/mein/abteilung");
  await expect(other).toHaveURL(/\/mein$/);

  const lead = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(lead, "Thomas Krüger");
  await expect(lead.getByText(/Korrekturantrag von Piotr Nowak/)).toBeVisible(); // Benachrichtigung
  await lead.goto("/mein/abteilung");
  const card = lead.getByTestId("korrekturantrag").filter({ hasText: "Piotr Nowak" });
  await expect(card).toContainText("17:30");
  await card.getByRole("button", { name: "Genehmigen" }).click();
  await expect(card).toHaveCount(0); // erledigt → aus der Liste verschwunden

  await emp.goto(`/mein/zeiten?monat=${datum.slice(0, 7)}`);
  await expect(emp.getByText("genehmigt", { exact: true })).toBeVisible();
  await expect(emp.getByText(/neu .*17:30/)).toBeVisible();
  await expect(emp.locator(`tr[data-date="${datum}"]`)).toContainText("korrigiert");
});

test("Admin korrigiert Tag mit Pflichtbegründung → Audit-Log, Warnung > 10 Std.", async ({ page }) => {
  const datum = lastWeekday(3);
  await adminSession(page);
  await page.goto("/admin/zeiten");
  await page.getByLabel("Mitarbeiter").selectOption({ label: "Becker, Max (1003)" });
  await page.getByRole("button", { name: "Anzeigen" }).click();
  if (!(await page.locator(`tr[data-date="${datum}"]`).isVisible())) {
    await page.getByRole("link", { name: "Vormonat" }).click();
  }
  await page.locator(`tr[data-date="${datum}"]`).getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByTestId("block-zeile").first()).toBeVisible();

  // ohne Begründung → Browser verhindert Absenden; mit zu kurzer → Server lehnt ab
  const last = page.getByTestId("block-zeile").last();
  await last.getByLabel(/bis Zeile/).fill("19:30");
  await page.getByLabel("Begründung (Pflicht)").fill("abc");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("button", { name: "Speichern" })).toBeVisible();
  await page.getByLabel("Begründung (Pflicht)").fill("Inventur, laut Rücksprache bis 19:30 gearbeitet");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert. Die Änderung ist im Änderungsprotokoll vermerkt.")).toBeVisible();

  await page.reload();
  const entry = page.getByTestId("audit-eintrag").first();
  await expect(entry).toContainText("Inventur");
  await expect(entry).toContainText("19:30");
  await expect(entry.locator(".line-through")).not.toContainText("19:30");
  // Originalstempelungen bleiben sichtbar
  await expect(page.getByText(/– Gehen \(Terminal\)/)).toBeVisible();

  // Hinweis > 10 Std. auf der Übersicht
  await page.goto("/admin");
  await expect(page.getByTestId("warnung").filter({ hasText: "Max Becker" }).filter({ hasText: "Mehr als 10 Std." })).toBeVisible();

  // Mitarbeiter sieht die Änderung
  const ctx = await page.context().browser()!.newContext({ ...test.info().project.use });
  const emp = await ctx.newPage();
  await loginEmployee(emp, "Max Becker");
  await emp.goto(`/mein/zeiten?monat=${datum.slice(0, 7)}`);
  await expect(emp.getByText("Inventur, laut Rücksprache bis 19:30 gearbeitet")).toBeVisible();
});

test("Saldo-Buchung und Arbeitszeitmodell", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/mitarbeiter");
  await page.getByRole("row", { name: /Becker, Max/ }).getByRole("link", { name: "Details" }).click();
  await page.getByLabel("gültig ab").fill("2027-01-01");
  await page.getByLabel("Stunden Fr").fill("6:00");
  await page.locator("form").filter({ has: page.getByLabel("gültig ab") }).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Arbeitszeitmodell gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("row", { name: /01\.01\.2027/ })).toContainText("38:00");

  await page.getByRole("link", { name: "Zeiten & Zeitkonto ansehen" }).click();
  await page.getByLabel("Art").selectOption("UEBERTRAG");
  await page.getByLabel("Stunden").fill("12:30");
  await page.getByLabel("Begründung (Pflicht)").fill("Überstunden aus alter Zeiterfassung");
  await page.getByRole("button", { name: "Buchen" }).click();
  await expect(page.getByText("Gebucht.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/\+12:30.*Überstunden aus alter Zeiterfassung/)).toBeVisible();
});

test("Fehlerfälle Korrekturantrag", async ({ page }) => {
  await loginEmployee(page, "Ali Yılmaz");
  await page.goto(`/mein/zeiten/korrektur?datum=${lastWeekday(1)}`);
  await page.getByLabel("Kommen").fill("16:00");
  await page.getByLabel("Gehen").fill("07:00");
  await page.getByLabel("Was war los?").fill("Test Nachtschicht");
  await page.getByRole("button", { name: "Antrag stellen" }).click();
  await expect(formAlert(page)).toContainText("„Gehen“ muss nach „Kommen“ liegen");
});
