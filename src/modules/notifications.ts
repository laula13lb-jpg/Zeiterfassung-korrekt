"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEmployee } from "@/modules/auth/guards";

export async function markNotificationsRead() {
  const emp = await requireEmployee();
  await db.notification.updateMany({ where: { employeeId: emp.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/mein");
}
