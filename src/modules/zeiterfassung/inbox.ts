import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentBlocks } from "./corrections";

/** Offene Korrekturanträge (optional gefiltert) inkl. aktueller Buchungen */
export async function openCorrectionRequests(where: Prisma.CorrectionRequestWhereInput = {}) {
  const list = await db.correctionRequest.findMany({
    where: { status: "BEANTRAGT", ...where },
    include: { employee: { select: { firstName: true, lastName: true, department: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(list.map(async (r) => ({ ...r, current: await currentBlocks(r.employeeId, r.workDate) })));
}
