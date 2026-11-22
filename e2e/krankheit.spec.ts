import { test } from "@playwright/test";
import { adminSession, expect, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht"));

const iso = (d: Date) => d.toISOString().slice(0, 10);
function berlinToday() {
  const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

test("Krankmeldung: Mitarbeiter meldet, Admin sieht Details, Abteilungsleiter nur „abwesend“", async ({ browser }) => {
  const use = test.info().project.use;
  const today = berlinToday();

  const emp = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(emp, "Marco Richter");
  await emp.goto("/mein/krank");
  await expect(emp.getByText(/keine Diagnose/)).toBeVisible();
  await emp.getByLabel("voraussichtlich bis").fill(iso(plus(today, 2)));
  await emp.getByRole("button", { name: "Krankmeldung absenden" }).click();
  await expect(emp.getByText("Krankmeldung gespeichert. Gute Besserung!")).toBeVisible();
  await emp.getByLabel("Krankmeldung verlängern bis").fill(iso(plus(today, 4)));
  await emp.getByRole("button", { name: "Verlängern" }).click();
  await expect(emp.getByText(/Verlängert bis/)).toBeVisible();

  // Abteilungsleiter: Benachrichtigung und Kalender ohne Grund
  const lead = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(lead, "Thomas Krüger");
  await expect(lead.getByText(/Marco Richter ist abwesend/).first()).toBeVisible();
  await expect(lead.getByRole("region", { name: "Neuigkeiten" })).not.toContainText("Krank");
  await lead.goto("/mein/abteilung");
  await expect(lead.locator(`td[title="Marco Richter: abwesend"]`).first()).toBeVisible();
  await expect(lead.locator(`td[title*="Krank"]`)).toHaveCount(0);
  // Krankheitsseite des Admins ist für Mitarbeiter-Sitzungen gesperrt
  await lead.goto("/admin/krankheit");
  await expect(lead).toHaveURL(/\/admin\/anmelden$/);

  // Admin: sieht „Krank“, setzt eAU abgerufen
  const admin = await (await browser.newContext({ ...use })).newPage();
  await adminSession(admin);
  await expect(admin.getByTestId("heute-abwesend")).toContainText("Marco Richter – Krank");
  await admin.goto("/admin/krankheit");
  const item = admin.getByTestId("krankmeldung").filter({ hasText: "Marco Richter" });
  await item.getByLabel("eAU abgerufen").check();
  await item.getByRole("button", { name: "Speichern" }).click();
  await expect(item.getByText("Gespeichert.")).toBeVisible();
  await emp.reload();
  await expect(emp.getByTestId("meine-krankmeldung").first()).toContainText("eAU abgerufen");
});

test("Krank im Urlaub: Urlaubstage erst nach Admin-Bestätigung zurück", async ({ browser }) => {
  const use = test.info().project.use;
  const today = berlinToday();
  // Montag der Vorwoche
  const mon = plus(today, -((today.getUTCDay() + 6) % 7) - 7);
  const admin = await (await browser.newContext({ ...use })).newPage();
  await adminSession(admin);
  await admin.goto("/admin/abwesenheiten");
  await admin.getByLabel("Mitarbeiter").selectOption({ label: "Nowak, Piotr" });
  await admin.getByLabel("von").fill(iso(mon));
  await admin.getByLabel("bis").fill(iso(plus(mon, 2)));
  await admin.getByRole("button", { name: "Eintragen" }).click();
  await expect(admin.getByText(/Urlaub \(3 Tage\) eingetragen/)).toBeVisible();

  const emp = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(emp, "Piotr Nowak");
  await emp.goto("/mein/urlaub");
  const before = Number((await emp.getByTestId("resturlaub").innerText()).match(/[\d,]+/)![0].replace(",", "."));

  await admin.goto("/admin/krankheit");
  const form = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Erfassen" }) });
  await form.getByLabel("Mitarbeiter").selectOption({ label: "Nowak, Piotr" });
  await form.getByLabel("krank von").fill(iso(plus(mon, 1)));
  await form.getByLabel("krank bis").fill(iso(plus(mon, 2)));
  await form.getByLabel("AU liegt vor").check();
  await form.getByRole("button", { name: "Erfassen" }).click();
  await expect(form.getByText("Gespeichert.")).toBeVisible();
  await admin.reload();
  const refund = admin.getByTestId("rueckbuchung").filter({ hasText: "Piotr Nowak" });
  await expect(refund).toContainText("2 Urlaubstage betroffen");

  // noch nicht bestätigt → Urlaub unverändert
  await emp.reload();
  await expect(emp.getByTestId("resturlaub")).toContainText(String(before).replace(".", ","));
  await refund.getByRole("button", { name: "Urlaubstage zurückbuchen" }).click();
  await expect(refund).toHaveCount(0); // erledigt
  await emp.reload();
  await expect(emp.getByTestId("resturlaub")).toContainText(String(before + 2).replace(".", ","));
});

test("Hinweise 6 Wochen / BEM in der Auswertung", async ({ page }) => {
  await adminSession(page);
  await page.goto("/admin/krankheit");
  const hints = page.getByTestId("krankheit-hinweise");
  await expect(hints).toContainText("Wolf, Jonas");
  await expect(hints).toContainText("6 Wochen am Stück");
  await expect(hints).toContainText("BEM");
});
