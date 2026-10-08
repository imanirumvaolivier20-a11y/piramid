"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PayCycle } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { fromDateInput, toDateInput } from "@/lib/format";
import { requireContext } from "@/lib/session";

/** Payroll is run per project by the managers of the account that employs the workers. */
async function requireProjectPayroll(projectId: string) {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  return { ctx, access, allowed: access.can.payroll };
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/my-pay");
}

/** The pay cycle belongs to the employing account and applies to all its projects. */
export async function setPayCycle(projectId: string, cycle: PayCycle) {
  const { access, allowed } = await requireProjectPayroll(projectId);
  if (!allowed) return;
  await prisma.account.update({ where: { id: access.actingAccountId }, data: { payCycle: cycle } });
  refresh(projectId);
}

const paymentSchema = z.object({
  amount: z.coerce.number("Enter the amount paid.").positive("Enter an amount above zero."),
  date: z.iso.date("Enter the payment date."),
  note: z.string().max(300).optional(),
  periodStart: z.iso.date().optional(),
  periodEnd: z.iso.date().optional(),
});

export async function recordPayment(
  projectId: string,
  workerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ctx, access, allowed } = await requireProjectPayroll(projectId);
  if (!allowed) return { error: "Only account owners and admins can record payments." };

  const worker = await ctx.db.worker.findFirst({ where: { id: workerId, accountId: access.actingAccountId } });
  if (!worker) return { error: "That worker is not on your team." };

  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    date: optional(formData.get("date")) ?? toDateInput(new Date()),
    note: optional(formData.get("note")),
    periodStart: optional(formData.get("periodStart")),
    periodEnd: optional(formData.get("periodEnd")),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  await ctx.db.workerPayment.create({
    data: {
      accountId: access.actingAccountId,
      projectId,
      workerId,
      amount: input.amount,
      date: fromDateInput(input.date),
      note: input.note,
      periodStart: input.periodStart ? fromDateInput(input.periodStart) : undefined,
      periodEnd: input.periodEnd ? fromDateInput(input.periodEnd) : undefined,
      createdById: ctx.user.id,
    },
  });
  refresh(projectId);
  return { success: `Payment to ${worker.name} recorded.` };
}

/** Sets or clears a worker's personal daily rate. Past attendance keeps its rate. */
export async function setWorkerRate(
  projectId: string,
  workerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { ctx, access, allowed } = await requireProjectPayroll(projectId);
  if (!allowed) return { error: "Only account owners and admins can change rates." };
  const raw = optional(formData.get("dailyRate"));
  const rate = raw === undefined ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { error: "Enter the daily rate as a number." };

  await ctx.db.worker.updateMany({ where: { id: workerId, accountId: access.actingAccountId }, data: { dailyRate: rate } });
  refresh(projectId);
  revalidatePath("/workers");
  return { success: rate === null ? "Now using the category rate." : "Daily rate saved." };
}
