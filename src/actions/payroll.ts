"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { fromDateInput, toDateInput } from "@/lib/format";
import { requireContext } from "@/lib/session";

/** Payroll belongs to the owners and admins of an account that manages workers. */
async function requirePayrollManager() {
  const ctx = await requireContext();
  return { ctx, allowed: ctx.account.type.canManageWorkers && ctx.isManager };
}

function refresh(workerId?: string) {
  revalidatePath("/payroll");
  revalidatePath("/workers");
  if (workerId) revalidatePath(`/workers/${workerId}`);
}

export async function setPayCycle(formData: FormData) {
  const { ctx, allowed } = await requirePayrollManager();
  const cycle = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).safeParse(formData.get("payCycle"));
  if (!allowed || !cycle.success) return;
  await prisma.account.update({ where: { id: ctx.account.id }, data: { payCycle: cycle.data } });
  refresh();
}

const paymentSchema = z.object({
  amount: z.coerce.number("Enter the amount paid.").positive("Enter an amount above zero."),
  date: z.iso.date("Enter the payment date."),
  note: z.string().max(300).optional(),
  periodStart: z.iso.date().optional(),
  periodEnd: z.iso.date().optional(),
});

export async function recordPayment(workerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, allowed } = await requirePayrollManager();
  if (!allowed) return { error: "Only account owners and admins can record payments." };

  const worker = await ctx.db.worker.findFirst({ where: { id: workerId, accountId: ctx.account.id } });
  if (!worker) return { error: "That worker is not on your roster." };

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
      accountId: ctx.account.id,
      workerId,
      amount: input.amount,
      date: fromDateInput(input.date),
      note: input.note,
      periodStart: input.periodStart ? fromDateInput(input.periodStart) : undefined,
      periodEnd: input.periodEnd ? fromDateInput(input.periodEnd) : undefined,
      createdById: ctx.user.id,
    },
  });
  refresh(workerId);
  return { success: `Payment to ${worker.name} recorded.` };
}

/** Sets or clears a worker's personal daily rate. Past attendance keeps its rate. */
export async function setWorkerRate(workerId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, allowed } = await requirePayrollManager();
  if (!allowed) return { error: "Only account owners and admins can change rates." };
  const raw = optional(formData.get("dailyRate"));
  const rate = raw === undefined ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return { error: "Enter the daily rate as a number." };

  await ctx.db.worker.updateMany({ where: { id: workerId, accountId: ctx.account.id }, data: { dailyRate: rate } });
  refresh(workerId);
  return { success: rate === null ? "Now using the category rate." : "Daily rate saved." };
}
