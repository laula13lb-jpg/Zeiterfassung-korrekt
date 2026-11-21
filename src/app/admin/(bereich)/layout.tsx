import { requireAdmin } from "@/modules/auth/guards";
import { logoutAdmin } from "@/modules/auth/actions";
import { adminNav } from "@/modules/navigation";
import { NavShell } from "@/components/NavShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { employee } = await requireAdmin();
  return (
    <NavShell title="Verwaltung" user={`${employee.firstName} ${employee.lastName}`} items={adminNav()} logout={logoutAdmin}>
      {children}
    </NavShell>
  );
}
