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
import { createHash } from "node:crypto";
import { TZDate } from "@date-fns/tz";
import { holidayName } from "../src/modules/zeiterfassung/holidays";

const db = new PrismaClient();
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const DEMO_PIN = "4711";
export const DEMO_ADMIN_PASSWORD = "Werkstatt-Start-2026!";

const DEPARTMENTS = [
  { name: "Karosserie (inkl. Mechanik)", sortOrder: 1, minStaffing: 1 },
  { name: "Lack", sortOrder: 2, minStaffing: 1 },
  { name: "Büro/Verwaltung", sortOrder: 3, minStaffing: 1, productive: false },
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
  { no: "1001", first: "Sabine", last: "Bludau", dept: 2, roles: ["MITARBEITER", "ADMIN"], login: "admin" },
  { no: "1002", first: "Thomas", last: "Krüger", dept: 1, roles: ["MITARBEITER", "ABTEILUNGSLEITER"] },
  { no: "1003", first: "Max", last: "Becker", dept: 0 },
  { no: "1004", first: "Jonas", last: "Wolf", dept: 0 },
  { no: "1005", first: "Ali", last: "Yılmaz", dept: 0 },
  { no: "1006", first: "Lena", last: "Hoffmann", dept: 2, part: true },
  { no: "1007", first: "Piotr", last: "Nowak", dept: 1 },
  { no: "1008", first: "Kevin", last: "Schulz", dept: 1, entry: "2026-04-01" },
  { no: "1009", first: "Marco", last: "Richter", dept: 1 },
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

/** Berliner Ortszeit → Date (UTC) */
const berlin = (y: number, m: number, d: number, hh: number, mm: number) => new Date(new TZDate(y, m - 1, d, hh, mm, 0, "Europe/Berlin").getTime());

/** Beispielzeiten der letzten 10 Arbeitstage (ohne heute) */
async function sampleTimes() {
  if ((await db.timeEntry.count()) > 0) return;
  const emps = await db.employee.findMany({ where: { tracksTime: true, pinMustChange: false } });
  const today = new TZDate(Date.now(), "Europe/Berlin");
  let added = 0;
  let firstDay: Date | null = null;
  for (let back = 1; added < 10 && back < 30; back++) {
    const d = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() - back, 12, 0, 0, "Europe/Berlin");
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    added++;
    const [y, m, dd] = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    const workDate = new Date(Date.UTC(y, m - 1, dd));
    firstDay = workDate;
    for (const [i, e] of emps.entries()) {
      const late = (i + back) % 4; // leichte Streuung
      const start = berlin(y, m, dd, 7, late);
      const endH = wd === 5 ? 14 : 15;
      const endM = 45 + ((i * 7 + back) % 15);
      // ein Beispieltag ohne Pause (für Pausenhinweis)
      const noBreak = i === 2 && back === 3;
      const blocks: [string, Date, Date][] = noBreak
        ? [["ARBEIT", start, berlin(y, m, dd, 15, 30)]]
        : [
            ["ARBEIT", start, berlin(y, m, dd, 9, 0)],
            ["PAUSE", berlin(y, m, dd, 9, 0), berlin(y, m, dd, 9, 20)],
            ["ARBEIT", berlin(y, m, dd, 9, 20), berlin(y, m, dd, 12, 30)],
            ["PAUSE", berlin(y, m, dd, 12, 30), berlin(y, m, dd, 12, 55)],
            ["ARBEIT", berlin(y, m, dd, 12, 55), berlin(y, m, dd, endH, endM)],
          ];
      for (const [kind, s0, e0] of blocks) {
        await db.timeEntry.create({ data: { employeeId: e.id, kind: kind as "ARBEIT" | "PAUSE", start: s0, end: e0, workDate, departmentId: e.departmentId } });
      }
      const ev = noBreak ? [["KOMMEN", start], ["GEHEN", blocks[0]![2]]] : [["KOMMEN", start], ["PAUSE_START", blocks[1]![1]], ["PAUSE_ENDE", blocks[1]![2]], ["PAUSE_START", blocks[3]![1]], ["PAUSE_ENDE", blocks[3]![2]], ["GEHEN", blocks[4]![2]]];
      for (const [type, at] of ev) {
        await db.stampEvent.create({ data: { employeeId: e.id, type: type as "KOMMEN", at: at as Date, source: "TERMINAL" } });
      }
    }
  }
  // Zeitkonto beginnt mit den Beispieldaten
  if (firstDay) await db.employee.updateMany({ where: { timeAccountStart: null, pinMustChange: false }, data: { timeAccountStart: firstDay } });
  // neue Testperson: Zeitkonto beginnt heute
  const t = new TZDate(Date.now(), "Europe/Berlin");
  await db.employee.updateMany({ where: { timeAccountStart: null }, data: { timeAccountStart: new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) } });
}

/** Beispiel-Urlaube: genehmigt, beantragt, Übernahme Resturlaub */
async function sampleAbsences() {
  if (await db.absenceRequest.count()) return;
  const urlaub = await db.absenceType.findUniqueOrThrow({ where: { code: "URLAUB" } });
  const t = new TZDate(Date.now(), "Europe/Berlin");
  const monday = (weeks: number) => {
    const d = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate() + weeks * 7));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d;
  };
  const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
  const by = async (no: string) => db.employee.findUniqueOrThrow({ where: { personnelNo: no } });
  const workdays = (a: Date, b: Date) => {
    let n = 0;
    for (let d = a; d <= b; d = plus(d, 1)) if (d.getUTCDay() % 6 !== 0 && !holidayName(d.toISOString().slice(0, 10))) n++;
    return n;
  };
  const piotr = await by("1007");
  const max = await by("1003");
  const kevin = await by("1008");
  await db.absenceRequest.create({ data: { employeeId: piotr.id, typeId: urlaub.id, startDate: monday(3), endDate: plus(monday(3), 4), days: workdays(monday(3), plus(monday(3), 4)), status: "GENEHMIGT" } });
  await db.absenceRequest.create({ data: { employeeId: max.id, typeId: urlaub.id, startDate: monday(5), endDate: plus(monday(5), 4), days: workdays(monday(5), plus(monday(5), 4)), status: "BEANTRAGT", comment: "Familienbesuch" } });
  // Krankheit: längere Episode (Hinweise 6 Wochen / BEM) und kurze Krankmeldung
  const jonas = await by("1004");
  const lena = await by("1006");
  const y = t.getFullYear();
  await db.sickLeave.create({ data: { employeeId: jonas.id, startDate: new Date(Date.UTC(y, 4, 4)), endDate: new Date(Date.UTC(y, 5, 15)), auPresent: true, eauRetrieved: true } });
  await db.sickLeave.create({ data: { employeeId: lena.id, startDate: plus(monday(-1), 1), endDate: plus(monday(-1), 2), auPresent: true } });
  // Übernahme aus altem System: 3 Tage Resturlaub
  await db.vacationEntitlement.update({ where: { employeeId_year: { employeeId: kevin.id, year: t.getFullYear() } }, data: { carryOverOverride: 3, note: "Übernahme aus bisheriger Liste" } });
}

/** Test-Terminal mit festem Freischaltcode TEST-2026 (nur Entwicklung) */
async function testTerminal() {
  if (await db.terminalDevice.count()) return;
  await db.terminalDevice.create({
    data: {
      name: "Werkstatt-Tablet (Test)",
      activationCodeHash: createHash("sha256").update("TEST-2026").digest("hex"),
      activationExpiresAt: new Date(Date.now() + 365 * 24 * 3600_000),
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.SEED_FORCE) {
    throw new Error("Seed mit Testdaten in Produktion verweigert.");
  }
  const depts = await base();
  await demo(depts);
  await sampleTimes();
  await sampleAbsences();
  await testTerminal();
  console.log(`Testdaten angelegt.
  Mitarbeiter-PIN (alle):  ${DEMO_PIN}   (Personalnummer 1010 „Neu Testperson“: Start-PIN 5308, muss geändert werden)
  Admin:                   Benutzer "admin" / Passwort "${DEMO_ADMIN_PASSWORD}" (muss beim ersten Login geändert werden)
  Abteilungsleiter:        Thomas Krüger (Lack), Personalnummer 1002
  Terminal-Freischaltcode: TEST-2026`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
