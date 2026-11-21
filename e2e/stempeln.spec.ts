import { test, type Page } from "@playwright/test";
import { adminSession, enterPin, expect, formAlert, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });

async function terminalPick(page: Page, name: string, pin = "4711") {
  await page.getByRole("button", { name, exact: true }).click();
  await enterPin(page, pin);
  await page.getByRole("button", { name: "Weiter" }).click();
}

test.describe("Werkstatt-Terminal", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "tablet-quer", "Terminal wird auf dem Tablet quer getestet"));

  test("Freischalten, Kommen, Pause, Pause Ende, Gehen", async ({ page }) => {
    await page.goto("/terminal");
    await page.getByLabel("Freischaltcode").fill("FALSCH-00");
    await page.getByRole("button", { name: "Terminal freischalten" }).click();
    await expect(formAlert(page)).toContainText("ungültig");
    await page.getByLabel("Freischaltcode").fill("test-2026");
    await page.getByRole("button", { name: "Terminal freischalten" }).click();
    await expect(page.getByText("Bitte Namen antippen")).toBeVisible();

    // falsche PIN
    await terminalPick(page, "Max Becker", "9182");
    await expect(formAlert(page)).toContainText("PIN falsch");
    await page.getByRole("button", { name: "Abbrechen" }).click();

    // Kommen
    await terminalPick(page, "Max Becker");
    await expect(page.getByText("Du bist nicht eingestempelt.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Gehen" })).toHaveCount(0);
    await page.getByRole("button", { name: "Kommen" }).click();
    await expect(page.getByRole("status")).toContainText(/, Max – eingestempelt \d\d:\d\d/);
    // automatische Rückkehr zum Startbildschirm
    await expect(page.getByText("Bitte Namen antippen")).toBeVisible({ timeout: 8000 });

    // Pause
    await terminalPick(page, "Max Becker");
    await expect(page.getByText(/Eingestempelt seit \d\d:\d\d/)).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Gute Pause, Max");
    await page.getByRole("status").click(); // Tippen → sofort zurück

    // Pause Ende
    await terminalPick(page, "Max Becker");
    await expect(page.getByText(/In Pause seit/)).toBeVisible();
    await page.getByRole("button", { name: "Pause Ende" }).click();
    await expect(page.getByRole("status")).toContainText("Weiter geht's, Max");
    await page.getByRole("status").click();

    // Gehen
    await terminalPick(page, "Max Becker");
    await page.getByRole("button", { name: "Gehen" }).click();
    await expect(page.getByRole("status")).toContainText("Schönen Feierabend, Max – ausgestempelt");
  });

  test("Terminal-Gerät öffnet keine anderen Bereiche", async ({ page }) => {
    await page.goto("/terminal");
    await page.getByLabel("Freischaltcode").isVisible(); // neuer Kontext: nicht freigeschaltet
    await page.goto("/mein");
    await expect(page).toHaveURL(/\/anmelden$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/anmelden$/);
  });

  test("Admin erzeugt Freischaltcode", async ({ page }) => {
    await adminSession(page);
    await page.goto("/admin/terminals");
    await page.getByRole("button", { name: "Terminal anlegen & Code erzeugen" }).click();
    await expect(page.getByTestId("terminal-code").first()).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    await expect(page.getByText("Werkstatt-Tablet (Test)")).toBeVisible();
  });
});

test.describe("Persönlicher Modus", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "smartphone", "persönlicher Modus wird auf dem Smartphone getestet"));

  test("Standard: Stempeln nur am Terminal", async ({ page }) => {
    await loginEmployee(page, "Piotr Nowak");
    await expect(page.getByText("Stempeln ist nur am Werkstatt-Terminal möglich.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kommen" })).toHaveCount(0);
    await expect(page.getByText(/Heute noch keine Buchungen/)).toBeVisible();
  });

  test("Admin erlaubt Handy-Stempeln → Kommen, Pause, Gehen", async ({ page, browser }) => {
    await adminSession(page);
    await page.goto("/admin/einstellungen");
    await page.getByLabel(/Stempeln auch vom Handy\/PC erlauben/).check();
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Gespeichert.")).toBeVisible();

    const ctx = await browser.newContext({ ...test.info().project.use });
    const p = await ctx.newPage();
    await loginEmployee(p, "Ali Yılmaz");
    await p.getByRole("button", { name: "Kommen" }).click();
    await expect(p.getByText(/Kommen um \d\d:\d\d gespeichert/)).toBeVisible();
    await expect(p.getByText("Eingestempelt", { exact: true })).toBeVisible();
    await expect(p.getByText(/Eingestempelt seit \d\d:\d\d/)).toBeVisible();
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(p.getByText("In Pause", { exact: true })).toBeVisible();
    await p.getByRole("button", { name: "Gehen" }).click();
    await expect(p.getByText("Nicht eingestempelt", { exact: true })).toBeVisible();
    await expect(p.getByRole("region", { name: "Heutige Buchungen" }).getByRole("listitem")).toHaveCount(2);
    await ctx.close();

    // Nur-Firmennetz: fremde IP wird abgewiesen (Testserver sieht 127.0.0.1 / ::1)
    await page.getByLabel(/Nur aus diesen Netzen/).fill("10.99.0.0/16");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Gespeichert.")).toBeVisible();
    const ctx2 = await browser.newContext({ ...test.info().project.use });
    const p2 = await ctx2.newPage();
    await loginEmployee(p2, "Ali Yılmaz");
    await expect(p2.getByText(/nur im Firmennetz/)).toBeVisible();
    await ctx2.close();

    // zurücksetzen
    await page.getByLabel(/Nur aus diesen Netzen/).fill("");
    await page.getByLabel(/Stempeln auch vom Handy\/PC erlauben/).uncheck();
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(page.getByText("Gespeichert.")).toBeVisible();
  });
});
