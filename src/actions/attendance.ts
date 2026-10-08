"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AttendanceStatus } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import type { ActionState } from "@/lib/action-state";
import { fromDateInput, toDateInput } from "@/lib/format";
import { attendanceShare, dailyRateOf } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

const statusSchema = z.enum(["PRESENT", "HALF_DAY", "ABSENT"]);

/**
 * Saves a day's attendance for the acting account's workers on a project.
 * Form fields: `date`, `status-<workerId>`, and `rate-<workerId>` for people
 * who may see money. Workers left unmarked are not changed.
 */
export async function saveAttendance(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.attendance) return { error: "You cannot record attendance on this project." };

  const dateText = String(formData.get("date") ?? "");
  if (!z.iso.date().safeParse(dateText).success) return { error: "Choose the date." };
  if (dateText > toDateInput(new Date())) return { error: "Attendance cannot be recorded for a future date." };
  const date = fromDateInput(dateText);

  const members = await ctx.db.projectMember.findMany({
    where: { projectId, accountId: access.actingAccountId, worker: { active: true } },
    include: { worker: { include: { category: true } } },
  });
  const existing = await ctx.db.attendance.findMany({
    where: { date, workerId: { in: members.map((m) => m.workerId) } },
    include: { project: true },
  });

  const elsewhere: string[] = [];
  const writes: Promise<unknown>[] = [];
  for (const { worker } of members) {
    const parsed = statusSchema.safeParse(formData.get(`status-${worker.id}`));
    if (!parsed.success) continue;
    const status: AttendanceStatus = parsed.data;

    const current = existing.find((a) => a.workerId === worker.id);
    if (current && current.projectId !== projectId) {
      elsewhere.push(`${worker.name} (${current.project.name})`);
      continue;
    }

    let rate = current ? Number(current.rate) : (dailyRateOf(worker) ?? 0);
    const typed = formData.get(`rate-${worker.id}`);
    if (access.can.viewMoney && typeof typed === "string" && typed.trim() !== "") {
      const value = Number(typed);
      if (!Number.isFinite(value) || value < 0) return { error: `Enter a valid daily rate for ${worker.name}.` };
      rate = value;
    }
    const data = { status, rate, amount: Math.round(rate * attendanceShare[status] * 100) / 100, recordedById: ctx.user.id };

    writes.push(
      ctx.db.attendance.upsert({
        where: { workerId_date: { workerId: worker.id, date } },
        update: data,
        create: { ...data, projectId, workerId: worker.id, accountId: worker.accountId, date },
      }),
    );
  }
  await Promise.all(writes);

  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/my-pay");
  if (elsewhere.length > 0) {
    return { error: `Saved, except ${elsewhere.join(", ")}: already recorded on another project that day.` };
  }
  return { success: `Attendance saved for ${writes.length} ${writes.length === 1 ? "worker" : "workers"}.` };
}
