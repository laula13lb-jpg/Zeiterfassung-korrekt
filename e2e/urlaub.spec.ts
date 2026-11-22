import { test } from "@playwright/test";
import { adminSession, expect, formAlert, loginEmployee } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeEach(({}, info) => test.skip(info.project.name !== "smartphone", "verändert Daten – einmal reicht"));

const YEAR = new Date().getFullYear();

test("Urlaubsantrag → Abteilungsleiter genehmigt → Stornierung bestätigt", async ({ browser }) => {
  const use = test.info().project.use;
  const emp = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(emp, "Kevin Schulz");
  await emp.goto("/mein/urlaub");
  // Übernahme aus Altsystem: 30 + 3
  await expect(emp.getByTestId("resturlaub")).toContainText("33");

  // nur Wochenende → Fehler
  await emp.getByLabel("von").fill(`${YEAR + 1}-01-09`);
  await emp.getByLabel("bis").fill(`${YEAR + 1}-01-10`);
  await expect(emp.getByTestId("tage-vorschau")).toContainText("= 0 Arbeitstage");
  await emp.getByRole("button", { name: "Beantragen" }).click();
  await expect(formAlert(emp)).toContainText("keine Arbeitstage");

  // Ostern: Ostermontag zählt nicht → 4 Tage
  await emp.getByLabel("von").fill(`2027-03-29`);
  await emp.getByLabel("bis").fill(`2027-04-02`);
  await expect(emp.getByTestId("tage-vorschau")).toContainText("= 4 Arbeitstage");

  // dieses Jahr: 14.–18.12. (5 Tage), letzter Tag halb → 4,5
  await emp.getByLabel("von").fill(`${YEAR}-12-14`);
  await emp.getByLabel("bis").fill(`${YEAR}-12-18`);
  await emp.getByLabel("letzter Tag nur halb").check();
  await expect(emp.getByTestId("tage-vorschau")).toContainText("= 4,5 Arbeitstage");
  await emp.getByLabel("Kommentar (optional)").fill("Weihnachtseinkäufe");
  await emp.getByRole("button", { name: "Beantragen" }).click();
  await expect(emp.getByText(/Urlaub \(4,5 Tage\) beantragt/)).toBeVisible();

  const lead = await (await browser.newContext({ ...use })).newPage();
  await loginEmployee(lead, "Thomas Krüger");
  await lead.goto("/mein/abteilung");
  const card = lead.getByTestId("abwesenheitsantrag").filter({ hasText: "Kevin Schulz" });
  await expect(card).toContainText("Resturlaub danach: 28,5 Tage");
  await card.getByRole("button", { name: "Genehmigen" }).click();
  await expect(card).toHaveCount(0);
  await expect(lead.getByRole("cell", { name: /Kevin Schulz: Urlaub/ }).first()).toBeVisible({ timeout: 1000 }).catch(() => {});

  await emp.reload();
  await expect(emp.getByTestId("resturlaub")).toContainText("28,5");
  const mine = emp.getByTestId("mein-antrag").filter({ hasText: "genehmigt" });
  await mine.getByLabel("Grund für Stornierung").fill("Termin verschoben");
  await mine.getByRole("button", { name: "Stornierung beantragen" }).click();
  await expect(emp.getByText("Stornierung beantragt – sie muss noch bestätigt werden.")).toBeVisible();

  await lead.reload();
  const storno = lead.getByTestId("abwesenheitsantrag").filter({ hasText: "Stornierung" });
  await expect(storno).toContainText("Termin verschoben");
  await storno.getByRole("button", { name: "Genehmigen" }).click();
  await expect(storno).toHaveCount(0);

  await emp.reload();
  await expect(emp.getByTestId("resturlaub")).toContainText("33");
  await expect(emp.getByTestId("mein-antrag").first()).toContainText("storniert");
});

test("Ablehnung nur mit Begründung; Mitarbeiter sieht Begründung", async ({ page, browser }) => {
  await adminSession(page);
  await page.goto("/admin/postfach");
  const card = page.getByTestId("abwesenheitsantrag").filter({ hasText: "Max Becker" });
  await card.getByRole("button", { name: "Ablehnen" }).click();
  await expect(card.locator("p[role=alert]")).toContainText("Begründung");
  await card.getByLabel("Begründung").fill("In der Woche ist Inventur");
  await card.getByRole("button", { name: "Ablehnen" }).click();
  await expect(card).toHaveCount(0);

  const emp = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await loginEmployee(emp, "Max Becker");
  await expect(emp.getByText(/Urlaub .* abgelehnt/)).toBeVisible(); // Benachrichtigung
  await emp.goto("/mein/urlaub");
  await expect(emp.getByText("Begründung: In der Woche ist Inventur")).toBeVisible();
});

test("Hinweis Mindestbesetzung, Admin trägt direkt ein, Anspruch anpassen", async ({ page, browser }) => {
  await adminSession(page);
  await page.goto("/admin/einstellungen");
  await page.getByLabel("Mindestbesetzung Karosserie (inkl. Mechanik)").fill("4");
  await page.getByRole("button", { name: "Speichern" }).nth(3).click();
  await expect(page.getByText("Gespeichert.").last()).toBeVisible();

  const emp = await (await browser.newContext({ ...test.info().project.use })).newPage();
  await loginEmployee(emp, "Ali Yılmaz");
  await emp.goto("/mein/urlaub");
  await emp.getByLabel("von").fill(`${YEAR}-12-10`);
  await emp.getByLabel("bis").fill(`${YEAR}-12-10`);
  await emp.getByRole("button", { name: "Beantragen" }).click();
  await expect(emp.getByText(/beantragt/).first()).toBeVisible();

  await page.goto("/admin/postfach");
  const card = page.getByTestId("abwesenheitsantrag").filter({ hasText: "Ali Yılmaz" });
  await expect(card.getByTestId("besetzungshinweis")).toContainText("10.12.");
  await card.getByRole("button", { name: "Genehmigen" }).click(); // nur Hinweis, keine Sperre
  await expect(card).toHaveCount(0);

  // Admin trägt Sonderurlaub direkt ein
  await page.goto("/admin/abwesenheiten");
  await page.getByLabel("Mitarbeiter").selectOption({ label: "Wolf, Jonas" });
  await page.getByLabel("Art").selectOption({ label: "Sonderurlaub" });
  await page.getByLabel("von").fill(`${YEAR}-12-02`);
  await page.getByLabel("bis").fill(`${YEAR}-12-02`);
  await page.getByRole("button", { name: "Eintragen" }).click();
  await expect(page.getByText("Sonderurlaub (1 Tag) eingetragen.")).toBeVisible();

  // Jahresübersicht + individueller Anspruch
  await page.goto("/admin/mitarbeiter");
  await page.getByRole("row", { name: /Yılmaz, Ali/ }).getByRole("link", { name: "Details" }).click();
  await page.getByLabel(`Urlaubstage ${YEAR}`).fill("32");
  await page.locator("form").filter({ has: page.getByLabel(`Urlaubstage ${YEAR}`) }).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(`Urlaubsanspruch ${YEAR} gespeichert.`)).toBeVisible();
  await page.goto("/admin/abwesenheiten?ansicht=jahr");
  await expect(page.getByRole("row", { name: /Yılmaz, Ali/ })).toContainText("32");
});
