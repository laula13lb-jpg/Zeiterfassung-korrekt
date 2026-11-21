import { test } from "@playwright/test";
import { enterPin, expect, formAlert, loginAdmin, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Mitarbeiter meldet sich mit Name + PIN an und ab", async ({ page }) => {
  await loginEmployee(page, "Max Becker");
  await expect(page).toHaveURL(/\/mein$/);
  await expect(page.getByRole("heading", { name: "Hallo Max!" })).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).first().click();
  await expect(page).toHaveURL(/\/anmelden$/);
});

test("Falsche PIN: Hinweis und Sperre nach 5 Versuchen", async ({ page }, info) => {
  const name = info.project.name === "smartphone" ? "Jonas Wolf" : "Marco Richter";
  await page.goto("/anmelden");
  await page.getByRole("button", { name, exact: true }).click();
  for (let i = 1; i <= 5; i++) {
    await enterPin(page, "9182");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await expect(formAlert(page)).toBeVisible();
  }
  await expect(formAlert(page)).toContainText("gesperrt");
  // auch die richtige PIN wird während der Sperre abgelehnt
  await enterPin(page, "4711");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(formAlert(page)).toContainText("gesperrt");
});

test("Erster Login erzwingt eigene PIN, triviale PIN wird abgelehnt", async ({ page }, info) => {
  test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht");
  await loginEmployee(page, "Neu Testperson", "5308");
  await expect(page).toHaveURL(/pin-aendern/);
  // Bereich ist ohne PIN-Wechsel nicht erreichbar
  await page.goto("/mein");
  await expect(page).toHaveURL(/pin-aendern/);

  await page.getByLabel("Bisherige PIN").fill("5308");
  await page.getByLabel("Neue PIN", { exact: true }).fill("1234");
  await page.getByLabel("Neue PIN wiederholen").fill("1234");
  await page.getByRole("button", { name: "PIN speichern" }).click();
  await expect(formAlert(page)).toContainText("Zahlenfolge");

  await page.getByLabel("Bisherige PIN").fill("5308");
  await page.getByLabel("Neue PIN", { exact: true }).fill("8462");
  await page.getByLabel("Neue PIN wiederholen").fill("8462");
  await page.getByRole("button", { name: "PIN speichern" }).click();
  await expect(page).toHaveURL(/\/mein$/);
});

test("Rechte werden serverseitig geprüft", async ({ page }) => {
  // ohne Anmeldung
  await page.goto("/mein");
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.goto("/admin/mitarbeiter");
  await expect(page).toHaveURL(/\/admin\/anmelden$/);
  // Mitarbeiter-Sitzung öffnet keinen Admin-Bereich – auch nicht als Admin-Person (getrennte Sitzungen)
  await loginEmployee(page, "Sabine Bludau");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/anmelden$/);
});

test("Admin: erster Login erzwingt Passwortwechsel", async ({ page }, info) => {
  test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht");
  await loginAdmin(page, "falsch-falsch");
  await expect(formAlert(page)).toContainText("falsch");

  await loginAdmin(page, "Werkstatt-Start-2026!");
  await expect(page).toHaveURL(/passwort-aendern/);
  await page.getByLabel("Bisheriges Passwort").fill("Werkstatt-Start-2026!");
  await page.getByLabel("Neues Passwort", { exact: true }).fill("zukurz");
  await page.getByLabel("Neues Passwort wiederholen").fill("zukurz");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  // Browser-Validierung (minLength) verhindert das Absenden
  await expect(page).toHaveURL(/passwort-aendern/);

  await page.getByLabel("Neues Passwort", { exact: true }).fill("Lack-trocknet-um-7!");
  await page.getByLabel("Neues Passwort wiederholen").fill("Lack-trocknet-um-7!");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
});

test("Health-Check antwortet", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBeTruthy();
  expect((await r.json()).status).toBe("ok");
});

test("Sicherheits-Header gesetzt", async ({ request }) => {
  const r = await request.get("/anmelden");
  const h = r.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("Admin: 2FA einrichten und damit anmelden", async ({ page }, info) => {
  test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht");
  const { authenticator } = await import("otplib");
  await loginAdmin(page, "Lack-trocknet-um-7!");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/sicherheit");
  await page.getByRole("button", { name: "2FA einrichten" }).click();
  await expect(page.getByAltText("QR-Code für die Authenticator-App")).toBeVisible();
  const secret = (await page.locator("code").textContent())!.trim();
  await page.getByLabel("Code aus der App").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Bestätigen und aktivieren" }).click();
  await expect(page.getByText("Zwei-Faktor-Anmeldung ist jetzt aktiv")).toBeVisible();

  // neu anmelden: jetzt mit Code
  await page.getByRole("button", { name: "Abmelden" }).first().click();
  await loginAdmin(page, "Lack-trocknet-um-7!");
  await expect(page).toHaveURL(/anmelden\/2fa/);
  // ohne Code kein Zugriff
  await page.goto("/admin/mitarbeiter");
  await expect(page).toHaveURL(/anmelden\/2fa/);
  await page.getByLabel("Bestätigungscode").fill("000000");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(formAlert(page)).toContainText("Code falsch");
  await page.getByLabel("Bestätigungscode").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});
