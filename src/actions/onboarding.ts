"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { defaultWorkerCategories } from "@/lib/labels";
import { ACTIVE_ACCOUNT_COOKIE, requireUser } from "@/lib/session";

const schema = z.object({
  typeKey: z.string({ error: "Choose what best describes you." }).min(1),
  name: z.string().trim().min(2, "Enter a name of at least 2 characters.").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,29}$/, "Username must be 3–30 characters: lowercase letters, numbers and dashes."),
  inviteCode: z.string().trim().toUpperCase().optional(),
});

function newInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function completeOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (await prisma.membership.count({ where: { userId: user.id } })) redirect("/dashboard");

  const parsed = schema.safeParse({
    typeKey: optional(formData.get("typeKey")),
    name: formData.get("name"),
    username: formData.get("username"),
    inviteCode: optional(formData.get("inviteCode")),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const input = parsed.data;

  const type = await prisma.accountType.findFirst({ where: { key: input.typeKey, selectable: true } });
  if (!type) return { error: "Choose what best describes you." };

  // Workers can join their company straight away with its invite code.
  let company = null;
  if (type.key === "WORKER" && input.inviteCode) {
    company = await prisma.account.findUnique({ where: { inviteCode: input.inviteCode } });
    if (!company) return { error: "That invite code does not match any company." };
  }

  if (await prisma.account.findUnique({ where: { username: input.username } })) {
    return { error: "That username is already taken." };
  }

  // Onboarding bootstraps the user's first tenant, so it uses the unscoped client.
  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        typeKey: type.key,
        name: input.name,
        username: input.username,
        email: user.email,
        ownerId: user.id,
        inviteCode: type.canManageWorkers ? newInviteCode() : null,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        categories: type.canManageWorkers
          ? { create: defaultWorkerCategories.map((name) => ({ name })) }
          : undefined,
      },
    });

    // Roster entries added with this email before the person signed up.
    await tx.worker.updateMany({ where: { email: user.email, userId: null }, data: { userId: user.id } });

    if (company) {
      await tx.membership.create({ data: { userId: user.id, accountId: company.id, role: "MEMBER" } });
      const onRoster = await tx.worker.count({ where: { accountId: company.id, userId: user.id } });
      if (!onRoster) {
        await tx.worker.create({
          data: { accountId: company.id, name: input.name, email: user.email, userId: user.id },
        });
      }
    }
    return created;
  });

  (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, company?.id ?? account.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard");
}
