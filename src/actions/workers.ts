"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";

async function requireRosterManager() {
  const ctx = await requireContext();
  const allowed = ctx.account.type.canManageWorkers && ctx.isManager;
  return { ctx, allowed };
}

// ───────────── Roster ─────────────

const workerSchema = z.object({
  name: z.string().trim().min(2, "Enter the worker's name.").max(80),
  categoryId: z.string().optional(),
  phone: z.string().max(30).optional(),
  email: z.email("Enter a valid email address.").optional(),
});

export async function addWorker(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, allowed } = await requireRosterManager();
  if (!allowed) return { error: "You cannot manage this account's workers." };

  const parsed = workerSchema.safeParse({
    name: formData.get("name"),
    categoryId: optional(formData.get("categoryId")),
    phone: optional(formData.get("phone")),
    email: optional(formData.get("email"))?.toLowerCase(),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, categoryId, phone, email } = parsed.data;

  if (categoryId) {
    const category = await ctx.db.workerCategory.findFirst({ where: { id: categoryId, accountId: ctx.account.id } });
    if (!category) return { error: "Choose one of your categories." };
  }
  // If the worker already has a login with this email, link it so they can see their projects.
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  await ctx.db.worker.create({
    data: { accountId: ctx.account.id, name, categoryId, phone, email, userId: user?.id },
  });
  revalidatePath("/workers");
  return {};
}

export async function removeWorker(workerId: string) {
  const { ctx, allowed } = await requireRosterManager();
  if (!allowed) return;
  await ctx.db.worker.deleteMany({ where: { id: workerId, accountId: ctx.account.id } });
  revalidatePath("/workers");
}

// ───────────── Categories ─────────────

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name.").max(60),
  dailyRate: z.coerce.number("Enter the daily rate as a number.").min(0).optional(),
});

export async function addCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { ctx, allowed } = await requireRosterManager();
  if (!allowed) return { error: "You cannot manage this account's categories." };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    dailyRate: optional(formData.get("dailyRate")),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const exists = await ctx.db.workerCategory.findFirst({
    where: { accountId: ctx.account.id, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (exists) return { error: "You already have a category with that name." };

  await ctx.db.workerCategory.create({ data: { accountId: ctx.account.id, ...parsed.data } });
  revalidatePath("/workers");
  return {};
}

export async function setCategoryRate(categoryId: string, formData: FormData) {
  const { ctx, allowed } = await requireRosterManager();
  if (!allowed) return;
  const raw = optional(formData.get("dailyRate"));
  const rate = raw === undefined ? null : Number(raw);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) return;
  await ctx.db.workerCategory.updateMany({
    where: { id: categoryId, accountId: ctx.account.id },
    data: { dailyRate: rate },
  });
  revalidatePath("/workers");
}

export async function removeCategory(categoryId: string) {
  const { ctx, allowed } = await requireRosterManager();
  if (!allowed) return;
  await ctx.db.workerCategory.deleteMany({ where: { id: categoryId, accountId: ctx.account.id } });
  revalidatePath("/workers");
}

// ───────────── Project team ─────────────

const assignSchema = z.object({
  workerId: z.string({ error: "Choose a worker." }).min(1),
  role: z.enum(["STORE_KEEPER", "FOREMAN", "ENGINEER", "BUILDER", "AID"], { error: "Choose a role." }),
});

export async function assignWorker(projectId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.team) return { error: "You cannot manage the team on this project." };

  const parsed = assignSchema.safeParse({
    workerId: optional(formData.get("workerId")),
    role: optional(formData.get("role")),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { workerId, role } = parsed.data;

  // Workers come from the roster of the account the user is acting for.
  const worker = await ctx.db.worker.findFirst({ where: { id: workerId, accountId: access.actingAccountId } });
  if (!worker) return { error: "Choose a worker from your roster." };

  await ctx.db.projectMember.upsert({
    where: { projectId_workerId: { projectId, workerId } },
    update: { role },
    create: { projectId, workerId, role, accountId: access.actingAccountId },
  });
  revalidatePath(`/projects/${projectId}/team`);
  return {};
}

export async function unassignWorker(projectId: string, memberId: string) {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.team) return;
  // Each side manages only the workers it brought onto the project.
  await ctx.db.projectMember.deleteMany({
    where: { id: memberId, projectId, accountId: access.actingAccountId },
  });
  revalidatePath(`/projects/${projectId}/team`);
}
