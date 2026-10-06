"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getProjectAccess } from "@/lib/access";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { fromDateInput } from "@/lib/format";
import { parseJsonList } from "@/lib/json";
import { canForward } from "@/lib/materials";
import { type Ctx, requireContext } from "@/lib/session";

const price = z.coerce.number("Prices must be numbers.").min(0, "Prices cannot be negative.").nullable();

const itemSchema = z.object({
  name: z.string().trim().min(1, "Every material needs a name.").max(120),
  details: z.string().trim().max(1000).optional(),
  quantity: z.coerce.number("Quantities must be numbers.").positive("Quantities must be above zero."),
  unit: z.string().trim().min(1, "Every material needs a unit (bags, m³, pcs…).").max(30),
  unitPrice: price,
});

const requestSchema = z.object({
  toAccountId: z.string().min(1, "Choose who the request goes to."),
  note: z.string().trim().max(2000).optional(),
  neededBy: z.iso.date("Enter a valid date.").optional(),
  items: z.array(itemSchema).min(1, "Add at least one material.").max(60),
});

/** Empty price fields arrive as "", which means "not known". */
function priceOrNull(value: unknown) {
  return value === "" || value === null || value === undefined ? null : value;
}

export async function createMaterialRequest(
  projectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, projectId);
  if (!access.can.requestMaterials) return { error: "You cannot request materials on this project." };

  const parsed = requestSchema.safeParse({
    toAccountId: optional(formData.get("toAccountId")),
    note: optional(formData.get("note")),
    neededBy: optional(formData.get("neededBy")),
    items: parseJsonList(formData.get("items")).map((item) => ({
      ...item,
      details: optional(item?.details ?? null),
      // People who cannot see money cannot price a request either.
      unitPrice: access.can.viewMoney ? priceOrNull(item?.unitPrice) : null,
    })),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  if (!access.recipients.some((r) => r.accountId === input.toAccountId)) {
    return { error: "Choose who the request goes to." };
  }

  const last = await ctx.db.materialRequest.aggregate({ where: { projectId }, _max: { number: true } });

  const request = await ctx.db.materialRequest.create({
    data: {
      projectId,
      number: (last._max.number ?? 0) + 1,
      fromAccountId: access.actingAccountId,
      toAccountId: input.toAccountId,
      note: input.note,
      neededBy: input.neededBy ? fromDateInput(input.neededBy) : undefined,
      requestedById: ctx.user.id,
      items: { create: input.items.map((item, sortOrder) => ({ ...item, sortOrder })) },
    },
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  redirect(`/projects/${projectId}/materials/${request.id}`);
}

async function loadRequest(ctx: Ctx, projectId: string, requestId: string) {
  const access = await getProjectAccess(ctx, projectId);
  const request = await ctx.db.materialRequest.findFirst({
    where: { id: requestId, projectId },
    include: { items: true },
  });
  return { access, request };
}

function done(projectId: string): ActionState {
  revalidatePath(`/projects/${projectId}`, "layout");
  return {};
}

/** Reads `price-<itemId>` fields into a map, ignoring unknown items. */
function readPrices(formData: FormData, itemIds: string[]) {
  const prices = new Map<string, number | null>();
  for (const id of itemIds) {
    const parsed = price.safeParse(priceOrNull(formData.get(`price-${id}`)));
    if (!parsed.success) return null;
    prices.set(id, parsed.data);
  }
  return prices;
}

export async function approveMaterialRequest(
  projectId: string,
  requestId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const { access, request } = await loadRequest(ctx, projectId, requestId);
  if (!request || request.status !== "SUBMITTED") return { error: "This request is no longer waiting for approval." };
  if (!access.manages(request.toAccountId)) return { error: "Only the account this request was sent to can approve it." };

  const prices = readPrices(formData, request.items.map((i) => i.id));
  if (!prices) return { error: "Prices must be numbers of zero or more." };

  await ctx.db.materialRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      decidedById: ctx.user.id,
      decidedAt: new Date(),
      decisionNote: optional(formData.get("decisionNote")) ?? null,
      items: {
        update: request.items.map((item) => ({ where: { id: item.id }, data: { unitPrice: prices.get(item.id) } })),
      },
    },
  });
  return done(projectId);
}

export async function rejectMaterialRequest(
  projectId: string,
  requestId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const { access, request } = await loadRequest(ctx, projectId, requestId);
  if (!request || request.status !== "SUBMITTED") return { error: "This request is no longer waiting for approval." };
  if (!access.manages(request.toAccountId)) return { error: "Only the account this request was sent to can reject it." };

  await ctx.db.materialRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      decidedById: ctx.user.id,
      decidedAt: new Date(),
      decisionNote: optional(formData.get("decisionNote")) ?? null,
    },
  });
  return done(projectId);
}

/** The hired company passes a request from its team on to the project owner to pay. */
export async function forwardMaterialRequest(projectId: string, requestId: string) {
  const ctx = await requireContext();
  const { access, request } = await loadRequest(ctx, projectId, requestId);
  if (!request || !canForward(access, request)) return;

  await ctx.db.materialRequest.update({
    where: { id: request.id },
    data: { toAccountId: access.project.accountId, forwardedAt: new Date() },
  });
  done(projectId);
}

export async function cancelMaterialRequest(projectId: string, requestId: string) {
  const ctx = await requireContext();
  const { request } = await loadRequest(ctx, projectId, requestId);
  if (!request || request.status !== "SUBMITTED" || request.requestedById !== ctx.user.id) return;

  await ctx.db.materialRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
  done(projectId);
}

/**
 * Confirms delivery: records the counted quantities (differences are
 * discrepancies) and logs the cost as a materials expense of the account
 * that paid.
 */
export async function receiveMaterialRequest(
  projectId: string,
  requestId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireContext();
  const { access, request } = await loadRequest(ctx, projectId, requestId);
  if (!request || request.status !== "APPROVED") return { error: "Only approved requests can be received." };
  if (!access.can.receiveMaterials && !access.manages(request.toAccountId)) {
    return { error: "You cannot confirm deliveries on this project." };
  }

  const quantity = z.coerce.number("Received quantities must be numbers.").min(0, "Received quantities cannot be negative.");
  const received = new Map<string, number>();
  for (const item of request.items) {
    const parsed = quantity.safeParse(formData.get(`received-${item.id}`) ?? "");
    if (!parsed.success) return firstIssue(parsed.error);
    received.set(item.id, parsed.data);
  }

  // The paying account can still correct prices on delivery, e.g. from the invoice.
  let prices = new Map(request.items.map((item) => [item.id, item.unitPrice === null ? null : Number(item.unitPrice)]));
  if (access.manages(request.toAccountId)) {
    const edited = readPrices(formData, request.items.map((i) => i.id));
    if (!edited) return { error: "Prices must be numbers of zero or more." };
    prices = edited;
  }

  const total = request.items.reduce((sum, item) => sum + received.get(item.id)! * (prices.get(item.id) ?? 0), 0);
  const today = new Date();

  await ctx.db.materialRequest.update({
    where: { id: request.id },
    data: {
      status: "RECEIVED",
      receivedById: ctx.user.id,
      receivedAt: today,
      receivedNote: optional(formData.get("receivedNote")) ?? null,
      items: {
        update: request.items.map((item) => ({
          where: { id: item.id },
          data: { receivedQuantity: received.get(item.id), unitPrice: prices.get(item.id) },
        })),
      },
      expense:
        total > 0
          ? {
              create: {
                projectId,
                accountId: request.toAccountId,
                category: "MATERIALS",
                amount: Math.round(total * 100) / 100,
                date: fromDateInput(today.toISOString().slice(0, 10)),
                note: `Material request #${request.number}`,
                createdById: ctx.user.id,
              },
            }
          : undefined,
    },
  });
  return done(projectId);
}
