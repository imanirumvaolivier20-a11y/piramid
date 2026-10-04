"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionState, firstIssue, optional } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { ACTIVE_ACCOUNT_COOKIE, requireContext } from "@/lib/session";

export async function switchAccount(formData: FormData) {
  const ctx = await requireContext();
  const accountId = String(formData.get("accountId"));
  if (ctx.memberships.some((m) => m.accountId === accountId)) {
    (await cookies()).set(ACTIVE_ACCOUNT_COOKIE, accountId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  redirect("/dashboard");
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter a name of at least 2 characters.").max(80),
  email: z.email("Enter a valid contact email.").optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(120).optional(),
  bio: z.string().max(1000).optional(),
});

export async function updateAccountProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  if (!ctx.isManager) return { error: "Only account owners and admins can edit the profile." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: optional(formData.get("email")),
    phone: optional(formData.get("phone")),
    location: optional(formData.get("location")),
    bio: optional(formData.get("bio")),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const { name, email, phone, location, bio } = parsed.data;

  await prisma.account.update({
    where: { id: ctx.account.id },
    data: { name, email: email ?? null, phone: phone ?? null, location: location ?? null, bio: bio ?? null },
  });
  revalidatePath("/", "layout");
  return {};
}
