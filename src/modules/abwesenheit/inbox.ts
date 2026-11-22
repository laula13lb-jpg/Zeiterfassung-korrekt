import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/time";
import { staffingConflicts } from "./absence-data";
import { vacationOverview } from "./vacation";

export type InboxAbsence = Awaited<ReturnType<typeof openAbsenceRequests>>[number];

/** Offene Abwesenheits- und Stornoanträge inkl. Besetzungshinweis und Resturlaub */
export async function openAbsenceRequests(where: Prisma.AbsenceRequestWhereInput = {}) {
  const list = await db.absenceRequest.findMany({
    where: { status: { in: ["BEANTRAGT", "STORNO_BEANTRAGT"] }, ...where },
    include: { type: true, employee: { select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } } } },
    orderBy: { startDate: "asc" },
  });
  return Promise.all(
    list.map(async (r) => {
      const conflicts = r.status === "BEANTRAGT" ? await staffingConflicts(r.id) : [];
      const ov = r.type.deductsVacation ? await vacationOverview(r.employeeId, r.startDate.getUTCFullYear()) : null;
      return {
        id: r.id,
        storno: r.status === "STORNO_BEANTRAGT",
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        department: r.employee.department?.name ?? "",
        type: r.type.name,
        range: r.startDate.getTime() === r.endDate.getTime() ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`,
        days: Number(r.days),
        comment: r.comment,
        cancelReason: r.cancelReason,
        remainingAfter: ov ? ov.balance.remaining - (r.status === "BEANTRAGT" ? Number(r.days) : 0) : null,
        conflicts,
      };
    }),
  );
}
