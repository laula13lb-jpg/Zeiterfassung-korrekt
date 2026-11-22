import { createHash } from "node:crypto";
import { test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "./env";
import { enterPin, expect } from "./helpers";

test("PWA: Manifest, Icons, Service Worker, Offline-Seite", async ({ request }) => {
  const m = await request.get("/manifest.webmanifest");
  expect(m.ok()).toBeTruthy();
  const json = await m.json();
  expect(json.short_name).toBe("Bludau Zeit");
  expect(json.display).toBe("standalone");
  for (const i of json.icons) expect((await request.get(i.src)).ok()).toBeTruthy();
  expect((await request.get("/sw.js")).ok()).toBeTruthy();
  expect(await (await request.get("/offline.html")).text()).toContain("Keine Verbindung");
});

async function activate(page: Page) {
  const db = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  await db.terminalDevice.updateMany({
    where: { name: "Werkstatt-Tablet (Test)" },
    data: { activationCodeHash: createHash("sha256").update("TEST-2026").digest("hex"), activationExpiresAt: new Date(Date.now() + 3600_000), active: true },
  });
  await db.$disconnect();
  await page.goto("/terminal");
  await page.getByLabel("Freischaltcode").fill("TEST-2026");
  await page.getByRole("button", { name: "Terminal freischalten" }).click();
  await expect(page.getByText("Bitte Namen antippen")).toBeVisible();
}

test("Terminal offline: Stempelung wird gespeichert und nachgereicht", async ({ page, context }, info) => {
  test.skip(info.project.name !== "tablet-quer", "Terminal wird auf dem Tablet getestet");
  await activate(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Piotr Nowak", exact: true }).click();
  await enterPin(page, "4711");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(/Keine Verbindung zum Server/)).toBeVisible();
  await page.getByRole("button", { name: "Kommen" }).click();
  await expect(page.getByRole("status")).toContainText(/Piotr – Kommen \d\d:\d\d offline gespeichert/);
  await expect(page.getByTestId("warteschlange")).toContainText("1 Stempelung(en) warten");

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("warteschlange")).toHaveText("", { timeout: 15_000 });

  const db = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  const emp = await db.employee.findUniqueOrThrow({ where: { personnelNo: "1007" } });
  const ev = await db.stampEvent.findFirst({ where: { employeeId: emp.id, offline: true }, orderBy: { receivedAt: "desc" } });
  const entry = await db.timeEntry.findFirst({ where: { employeeId: emp.id, end: null, voidedAt: null } });
  await db.$disconnect();
  expect(ev?.type).toBe("KOMMEN");
  expect(ev!.receivedAt.getTime()).toBeGreaterThanOrEqual(ev!.at.getTime());
  expect(entry?.origin).toBe("OFFLINE");
});
