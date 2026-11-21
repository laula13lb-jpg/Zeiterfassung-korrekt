import { expect, type Page } from "@playwright/test";

export async function enterPin(page: Page, pin: string) {
  for (const d of pin) await page.getByRole("button", { name: d, exact: true }).click();
}

export async function loginEmployee(page: Page, name: string, pin = "4711") {
  await page.goto("/anmelden");
  await page.getByRole("button", { name, exact: true }).click();
  await enterPin(page, pin);
  await page.getByRole("button", { name: "Anmelden" }).click();
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
