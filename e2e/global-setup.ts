import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "./env";

/**
 * Eigene Test-Datenbank (Name muss auf "_e2e" enden): Schema aktualisieren,
 * alle Tabellen leeren, Testdaten einspielen. Läuft nie gegen die echte Datenbank.
 */
export default async function globalSetup() {
  const dbName = new URL(E2E_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_e2e")) throw new Error(`E2E-Datenbank muss auf _e2e enden (ist: ${dbName})`);
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });

  const db = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  }
  await db.$disconnect();
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
