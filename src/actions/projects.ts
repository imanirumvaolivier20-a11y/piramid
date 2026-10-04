"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { fromDateInput } from "@/lib/format";
import { requireContext } from "@/lib/session";

const schema = z.object({
  name: z.string().trim().min(2, "Enter a project name.").max(120),
  location: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  startDate: z.iso.date("Enter a valid start date.").optional(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]),
});

export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  if (!ctx.account.type.canOwnProjects) return { error: "This account type cannot own projects." };
  if (!ctx.isManager) return { error: "Only account owners and admins can create projects." };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    location: optional(formData.get("location")),
    description: optional(formData.get("description")),
    startDate: optional(formData.get("startDate")),
    status: formData.get("status"),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { startDate, ...rest } = parsed.data;

  const project = await ctx.db.project.create({
    data: {
      ...rest,
      startDate: startDate ? fromDateInput(startDate) : null,
      accountId: ctx.account.id,
      createdById: ctx.user.id,
    },
  });
  redirect(`/projects/${project.id}`);
}
