import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL } from "./e2e/env";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", locale: "de-DE", timezoneId: "Europe/Berlin" },
  projects: [
    { name: "smartphone", use: { ...devices["Pixel 7"] } },
    { name: "tablet-quer", use: { ...devices["Galaxy Tab S4 landscape"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: { COOKIE_SECURE: "false", DATABASE_URL: E2E_DATABASE_URL },
  },
});
