"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { fromDateInput } from "@/lib/format";
import { requireContext } from "@/lib/session";
import { imageProblem, saveImage } from "@/lib/storage";

const schema = z.object({
  category: z.enum(["MATERIALS", "SALARIES", "LABOR", "TRANSPORT", "EQUIPMENT", "PERMITS", "OTHER"], {
    error: "Choose a category.",
  }),
  amount: z.coerce.number("Enter the amount as a number.").positive("Enter an amount above zero."),
  date: z.iso.date("Enter the date of the expense."),
  note: z.string().max(500).optional(),
});

export async function addExpense(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.expense) return { error: "You cannot log expenses on this project." };

  const parsed = schema.safeParse({
    category: optional(formData.get("category")),
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: optional(formData.get("note")),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const receipt = formData.get("receipt");
  let receiptKey: string | undefined;
  if (receipt instanceof File && receipt.size > 0) {
    const problem = imageProblem(receipt);
    if (problem) return { error: problem };
    receiptKey = (await saveImage(receipt, "receipts")).key;
  }

  await ctx.db.expense.create({
    data: {
      ...parsed.data,
      date: fromDateInput(parsed.data.date),
      receiptKey,
      projectId,
      accountId: access.actingAccountId,
      createdById: ctx.user.id,
    },
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  return {};
}
