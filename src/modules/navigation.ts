import type { Employee } from "@prisma/client";
import type { NavItem } from "@/components/NavShell";

/** Menü des persönlichen Bereichs – Module registrieren hier ihre Einträge */
export function employeeNav(e: Pick<Employee, "roles">): NavItem[] {
  const items: NavItem[] = [
    { href: "/mein", label: "Heute" },
    { href: "/mein/zeiten", label: "Meine Zeiten", soon: true },
    { href: "/mein/urlaub", label: "Urlaub", soon: true },
    { href: "/mein/krank", label: "Krankmeldung", soon: true },
  ];
  if (e.roles.includes("ABTEILUNGSLEITER")) items.push({ href: "/mein/abteilung", label: "Meine Abteilung", soon: true });
  items.push({ href: "/mein/auftraege", label: "Aufträge", soon: true }, { href: "/mein/pin", label: "PIN ändern" });
  return items;
}

export function adminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Übersicht" },
    { href: "/admin/anwesenheit", label: "Anwesenheit", soon: true },
    { href: "/admin/postfach", label: "Anträge", soon: true },
    { href: "/admin/mitarbeiter", label: "Mitarbeiter", soon: true },
    { href: "/admin/zeiten", label: "Zeiten", soon: true },
    { href: "/admin/abwesenheiten", label: "Abwesenheiten", soon: true },
    { href: "/admin/auswertung", label: "Monatsabschluss & Export", soon: true },
    { href: "/admin/auftraege", label: "Aufträge", soon: true },
    { href: "/admin/einstellungen", label: "Einstellungen", soon: true },
    { href: "/admin/sicherheit", label: "Mein Zugang (2FA)" },
  ];
}
