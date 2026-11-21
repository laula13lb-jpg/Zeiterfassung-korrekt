import { requireEmployee } from "@/modules/auth/guards";
import { logoutEmployee } from "@/modules/auth/actions";
import { employeeNav } from "@/modules/navigation";
import { NavShell } from "@/components/NavShell";

export default async function MeinLayout({ children }: { children: React.ReactNode }) {
  const emp = await requireEmployee();
  return (
    <NavShell title="Mein Bereich" user={`${emp.firstName} ${emp.lastName}`} items={employeeNav(emp)} logout={logoutEmployee}>
      {children}
    </NavShell>
  );
}
