"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue } from "@/lib/action-state";
import { fromDateInput } from "@/lib/format";
import { parseJsonList } from "@/lib/json";
import { requireContext } from "@/lib/session";
import { imageProblem, saveImage } from "@/lib/storage";

const MAX_PHOTOS = 10;

const schema = z.object({
  date: z.iso.date("Enter the date of the work."),
  description: z.string().trim().min(3, "Describe the work that was completed.").max(5000),
  workersCount: z.coerce.number("Enter how many people worked.").int().min(0).max(10000),
  materials: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Every material needs a name.").max(120),
        quantity: z.coerce.number("Material quantities must be numbers.").positive("Material quantities must be above zero."),
        unit: z.string().trim().min(1, "Every material needs a unit (bags, m³, pcs…).").max(30),
      }),
    )
    .max(50),
  wages: z
    .array(
      z.object({
        categoryId: z.string().nullable(),
        categoryName: z.string().trim().min(1, "Every wage line needs a category.").max(80),
        workers: z.coerce.number("Worker counts must be numbers.").int().min(0),
        amount: z.coerce.number("Wage amounts must be numbers.").min(0),
      }),
    )
    .max(30),
});

export async function createDailyReport(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.report) return { error: "You cannot submit reports on this project." };

  const wages = parseJsonList(formData.get("wages"));
  const parsed = schema.safeParse({
    date: formData.get("date"),
    description: formData.get("description"),
    // Left empty, the head count defaults to the workers counted in the wage lines.
    workersCount:
      formData.get("workersCount") || wages.reduce((sum: number, w) => sum + (Number(w?.workers) || 0), 0),
    materials: parseJsonList(formData.get("materials")),
    wages,
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > MAX_PHOTOS) return { error: `Attach at most ${MAX_PHOTOS} photos per report.` };
  for (const photo of photos) {
    const problem = imageProblem(photo);
    if (problem) return { error: problem };
  }

  // Only keep category links that belong to the account the author acts for.
  const categories = await ctx.db.workerCategory.findMany({
    where: { accountId: access.actingAccountId },
    select: { id: true },
  });
  const known = new Set(categories.map((c) => c.id));

  const stored = await Promise.all(photos.map((photo) => saveImage(photo, "reports")));

  await ctx.db.dailyReport.create({
    data: {
      projectId,
      accountId: access.actingAccountId,
      createdById: ctx.user.id,
      date: fromDateInput(input.date),
      description: input.description,
      workersCount: input.workersCount,
      photos: { create: stored },
      materials: { create: input.materials },
      wages: {
        create: input.wages.map((w) => ({
          ...w,
          categoryId: w.categoryId && known.has(w.categoryId) ? w.categoryId : null,
        })),
      },
    },
  });
  redirect(`/projects/${projectId}`);
}
