import Link from "next/link";
import { db } from "@/lib/db";
import { berlinDay, dayKey } from "@/lib/time";
import { requireAdmin } from "@/modules/auth/guards";
import { EmployeeForm } from "@/components/EmployeeForm";

export const metadata = { title: "Mitarbeiter anlegen" };

export default async function Neu() {
  await requireAdmin();
  const depts = await db.department.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/admin/mitarbeiter" className="font-semibold underline">← Mitarbeiterliste</Link>
      <h1 className="text-3xl font-extrabold">Mitarbeiter anlegen</h1>
      <EmployeeForm depts={depts} initial={{ personnelNo: "", firstName: "", lastName: "", email: "", departmentId: "", entryDate: dayKey(berlinDay()), tracksTime: true, lead: false, admin: false, leadOf: [], loginName: "" }} />
    </div>
  );
}
