import "server-only";
import { redirect } from "next/navigation";
import type { Employee, Role } from "@prisma/client";
import { getSession } from "./session";

export class ForbiddenError extends Error {
  constructor(msg = "Keine Berechtigung") {
    super(msg);
  }
}

export const hasRole = (e: Pick<Employee, "roles">, role: Role) => e.roles.includes(role);

/**
 * Serverseitige Prüfungen – bei JEDER Seite/Aktion aufrufen.
 * Die Oberfläche blendet nur aus; maßgeblich ist diese Prüfung.
 */
export async function requireEmployee(opts: { allowPinChange?: boolean } = {}) {
  const s = await getSession("MITARBEITER");
  if (!s) redirect("/anmelden");
  if (s.employee.pinMustChange && !opts.allowPinChange) redirect("/anmelden/pin-aendern");
  return s.employee;
}

export async function requireAdmin(opts: { allowPasswordChange?: boolean; allowPending2fa?: boolean } = {}) {
  const s = await getSession("ADMIN");
  if (!s || !hasRole(s.employee, "ADMIN")) redirect("/admin/anmelden");
  if (s.pending2fa && !opts.allowPending2fa) redirect("/admin/anmelden/2fa");
  if (s.employee.passwordMustChange && !opts.allowPasswordChange) redirect("/admin/passwort-aendern");
  return { employee: s.employee, session: s };
}

/** Abteilungsleiter darf Personen dieser Abteilungen sehen/genehmigen */
export function leadsDepartment(lead: Employee & { ledDepartments?: { id: string }[] }, departmentId: string | null) {
  if (!departmentId || !hasRole(lead, "ABTEILUNGSLEITER")) return false;
  return (lead.ledDepartments ?? []).some((d) => d.id === departmentId);
}
