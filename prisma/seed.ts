/**
 * Testdaten: 1 Admin, 1 Abteilungsleiter, 8 Mitarbeiter, Abwesenheitsarten,
 * Arbeitszeitmodelle, Urlaubsansprüche, Beispielzeiten, -urlaub und -krankmeldung.
 *
 * Aufruf: npm run db:seed   (verweigert in Produktion ohne SEED_FORCE=1)
 * Grunddaten (Abteilungen, Abwesenheitsarten) kommen per Migration
 * (prisma/migrations/*_grunddaten) und sind damit auch in Produktion vorhanden.
 */
import { PrismaClient, type Role } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const db = new PrismaClient();
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const DEMO_PIN = "4711";
export const DEMO_ADMIN_PASSWORD = "Werkstatt-Start-2026!";

const DEPARTMENTS = [
  { name: "Karosserie (inkl. Mechanik)", sortOrder: 1, minStaffing: 1 },
  { name: "Vorarbeit", sortOrder: 2, minStaffing: 1 },
  { name: "Lackierung", sortOrder: 3, minStaffing: 1 },
  { name: "Finish", sortOrder: 4, minStaffing: 1 },
  { name: "Büro/Verwaltung", sortOrder: 5, minStaffing: 1, productive: false },
];

const ABSENCE_TYPES = [
  { code: "URLAUB", name: "Urlaub", category: "URLAUB", deductsVacation: true, creditsTarget: true, color: "#1d4ed8", system: true },
  { code: "SONDERURLAUB", name: "Sonderurlaub", category: "SONDERURLAUB", deductsVacation: false, creditsTarget: true, color: "#7c3aed", system: true },
  { code: "UNBEZAHLT", name: "Unbezahlter Urlaub", category: "UNBEZAHLT", deductsVacation: false, creditsTarget: false, color: "#64748b", system: true },
  { code: "FZA", name: "Freizeitausgleich (Überstundenabbau)", category: "FREIZEITAUSGLEICH", deductsVacation: false, creditsTarget: false, color: "#0891b2", system: true },
  { code: "BERUFSSCHULE", name: "Berufsschule", category: "SONSTIGE", deductsVacation: false, creditsTarget: true, color: "#ca8a04", system: false, requiresApproval: false },
  { code: "SCHULUNG", name: "Schulung", category: "SONSTIGE", deductsVacation: false, creditsTarget: true, color: "#16a34a", system: false },
] as const;

type P = { no: string; first: string; last: string; dept: number; roles?: Role[]; login?: string; mustChange?: boolean; part?: boolean; entry?: string };
const PEOPLE: P[] = [
  { no: "1001", first: "Sabine", last: "Bludau", dept: 4, roles: ["MITARBEITER", "ADMIN"], login: "admin" },
  { no: "1002", first: "Thomas", last: "Krüger", dept: 2, roles: ["MITARBEITER", "ABTEILUNGSLEITER"] },
  { no: "1003", first: "Max", last: "Becker", dept: 0 },
  { no: "1004", first: "Jonas", last: "Wolf", dept: 0 },
  { no: "1005", first: "Ali", last: "Yılmaz", dept: 1 },
  { no: "1006", first: "Lena", last: "Hoffmann", dept: 1, part: true },
  { no: "1007", first: "Piotr", last: "Nowak", dept: 2 },
  { no: "1008", first: "Kevin", last: "Schulz", dept: 3, entry: "2026-04-01" },
  { no: "1009", first: "Marco", last: "Richter", dept: 3 },
  { no: "1010", first: "Neu", last: "Testperson", dept: 0, mustChange: true },
];

const day = (s: string) => new Date(`${s}T00:00:00Z`);

async function base() {
  const depts = [];
  for (const d of DEPARTMENTS) {
    depts.push(await db.department.upsert({ where: { name: d.name }, update: {}, create: d }));
  }
  for (const t of ABSENCE_TYPES) {
    await db.absenceType.upsert({ where: { code: t.code }, update: {}, create: { ...t } });
  }
  return depts;
}

async function demo(depts: Awaited<ReturnType<typeof base>>) {
  const pinHash = await hash(DEMO_PIN, OPTS);
  const startPinHash = await hash("5308", OPTS);
  const pwHash = await hash(DEMO_ADMIN_PASSWORD, OPTS);
  const year = new Date().getFullYear();

  for (const p of PEOPLE) {
    const isAdmin = p.roles?.includes("ADMIN");
    const emp = await db.employee.upsert({
      where: { personnelNo: p.no },
      update: {},
      create: {
        personnelNo: p.no,
        firstName: p.first,
        lastName: p.last,
        departmentId: depts[p.dept]!.id,
        roles: p.roles ?? ["MITARBEITER"],
        entryDate: day(p.entry ?? "2020-01-01"),
        pinHash: p.mustChange ? startPinHash : pinHash,
        pinMustChange: !!p.mustChange,
        loginName: p.login ?? null,
        passwordHash: isAdmin ? pwHash : null,
        passwordMustChange: true,
      },
    });
    if (p.roles?.includes("ABTEILUNGSLEITER")) {
      await db.department.update({ where: { id: depts[p.dept]!.id }, data: { leads: { connect: { id: emp.id } } } });
    }
    await db.workSchedule.upsert({
      where: { employeeId_validFrom: { employeeId: emp.id, validFrom: emp.entryDate } },
      update: {},
      create: p.part
        ? // Teilzeit 25 Std.: Mo–Do je 6:15 Std., Freitag frei
          { employeeId: emp.id, validFrom: emp.entryDate, monMinutes: 375, tueMinutes: 375, wedMinutes: 375, thuMinutes: 375, friMinutes: 0 }
        : // Vollzeit 39 Std.: Mo–Do 8 Std., Fr 7 Std.
          { employeeId: emp.id, validFrom: emp.entryDate },
    });
    for (const y of [year, year + 1]) {
      await db.vacationEntitlement.upsert({
        where: { employeeId_year: { employeeId: emp.id, year: y } },
        update: {},
        create: { employeeId: emp.id, year: y, days: p.part ? 24 : 30 },
      });
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) {
    throw new Error("Seed mit Testdaten in Produktion verweigert.");
  }
  const depts = await base();
  await demo(depts);
  console.log(`Testdaten angelegt.
  Mitarbeiter-PIN (alle):  ${DEMO_PIN}   (Personalnummer 1010 „Neu Testperson“: Start-PIN 5308, muss geändert werden)
  Admin:                   Benutzer "admin" / Passwort "${DEMO_ADMIN_PASSWORD}" (muss beim ersten Login geändert werden)
  Abteilungsleiter:        Thomas Krüger (Lackierung), Personalnummer 1002`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
