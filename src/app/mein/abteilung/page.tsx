import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireEmployee } from "@/modules/auth/guards";
import { openCorrectionRequests } from "@/modules/zeiterfassung/inbox";
import { decideCorrectionLead } from "@/modules/zeiterfassung/correction-actions";
import { CorrectionRequestList } from "@/components/CorrectionRequestList";

export const metadata = { title: "Meine Abteilung" };

export default async function Abteilung() {
  const emp = await requireEmployee();
  if (!emp.roles.includes("ABTEILUNGSLEITER")) redirect("/mein");
  const me = await db.employee.findUniqueOrThrow({ where: { id: emp.id }, include: { ledDepartments: true } });
  const deptIds = me.ledDepartments.map((d) => d.id);
  const requests = await openCorrectionRequests({ employee: { departmentId: { in: deptIds } }, employeeId: { not: emp.id } });
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Meine Abteilung</h1>
      <p>{me.ledDepartments.map((d) => d.name).join(", ")}</p>
      <h2 className="text-xl font-bold">Korrekturanträge</h2>
      <CorrectionRequestList requests={requests} action={decideCorrectionLead} />
      <p className="text-sm">Urlaubsanträge und Anwesenheit folgen in Meilenstein 4/5.</p>
    </div>
  );
}
