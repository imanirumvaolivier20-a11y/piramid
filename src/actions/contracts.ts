"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";

const hireSchema = z.object({
  engagementModel: z.enum(["FULL_MANAGEMENT", "OWNER_FUNDS"], { error: "Choose how you want to work together." }),
  agreedBudget: z.coerce.number("Enter the budget as a number.").positive("Enter a budget above zero.").optional(),
  note: z.string().max(1000).optional(),
});

export async function hireContractor(
  projectId: string,
  contractorAccountId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.hire) {
    return { error: access.contract ? "This project already has a hire in place." : "You cannot hire for this project." };
  }

  const contractor = await prisma.account.findUnique({ where: { id: contractorAccountId }, include: { type: true } });
  if (!contractor?.type.canBeHired) return { error: "This account cannot be hired." };
  if (contractor.id === access.project.accountId) return { error: "You cannot hire your own account." };

  const parsed = hireSchema.safeParse({
    engagementModel: optional(formData.get("engagementModel")),
    agreedBudget: optional(formData.get("agreedBudget")),
    note: optional(formData.get("note")),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { engagementModel, agreedBudget, note } = parsed.data;

  await ctx.db.contract.create({
    data: {
      projectId,
      ownerAccountId: access.project.accountId,
      contractorAccountId: contractor.id,
      engagementModel,
      // The budget is only recorded for now; no payment logic depends on it yet.
      agreedBudget: engagementModel === "FULL_MANAGEMENT" ? agreedBudget : undefined,
      note,
      hiredById: ctx.user.id,
    },
  });
  redirect(`/projects/${projectId}`);
}

export async function respondToHire(projectId: string, accept: boolean) {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.respond || !access.contract) return;

  await ctx.db.contract.update({
    where: { id: access.contract.id },
    data: { status: accept ? "ACTIVE" : "DECLINED", respondedAt: new Date() },
  });
  if (accept) {
    revalidatePath(`/projects/${projectId}`, "layout");
    return;
  }
  redirect("/dashboard"); // declining removes access to the project
}

/** The owner cancels a pending request or ends an active hire. */
export async function endContract(projectId: string) {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.endContract || !access.contract) return;

  await ctx.db.contract.update({
    where: { id: access.contract.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  revalidatePath(`/projects/${projectId}`, "layout");
}
