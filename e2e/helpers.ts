import { expect, type Page } from "@playwright/test";

export async function enterPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
}

export async function loginEmployee(page: Page, name: string, pin = "4711") {
  await page.goto("/anmelden");
  await page.getByRole("button", { name, exact: true }).click();
  await enterPin(page, pin);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/\/mein$|pin-aendern/);
}

export async function loginAdmin(page: Page, password: string) {
  await page.goto("/admin/anmelden");
  await page.getByLabel("Benutzername").fill("admin");
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

export { expect };

/** Fehlermeldung eines Formulars (nicht der Next.js-Routenansager) */
export const formAlert = (page: Page) => page.locator("p[role=alert]");

export const ADMIN_START_PW = "Werkstatt-Start-2026!";
export const ADMIN_PW = "Lack-trocknet-um-7!";

/** Als Admin anmelden – egal ob das Startpasswort schon geändert wurde */
export async function adminSession(page: Page) {
  await loginAdmin(page, ADMIN_PW);
  await page.waitForLoadState("networkidle");
  if (await formAlert(page).isVisible()) {
    await loginAdmin(page, ADMIN_START_PW);
    await page.waitForURL(/passwort-aendern|\/admin$/);
    if (page.url().includes("passwort-aendern")) {
      await page.getByLabel("Bisheriges Passwort").fill(ADMIN_START_PW);
      await page.getByLabel("Neues Passwort", { exact: true }).fill(ADMIN_PW);
      await page.getByLabel("Neues Passwort wiederholen").fill(ADMIN_PW);
      await page.getByRole("button", { name: "Passwort speichern" }).click();
    }
  }
  await expect(page).toHaveURL(/\/admin$/);
}
