import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dbFor, prisma } from "@/lib/db";

export const ACTIVE_ACCOUNT_COOKIE = "activeAccount";

/** The signed-in user, or null. Also null if the session points at a deleted user. */
export const getSessionUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Everything a page or action needs: the user, their accounts, the account
 * they are currently acting as, and a tenant-scoped database client.
 */
export const requireContext = cache(async () => {
  const user = await requireUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { account: { include: { type: true, owner: { select: { image: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) redirect("/onboarding");

  const wanted = (await cookies()).get(ACTIVE_ACCOUNT_COOKIE)?.value;
  const active = memberships.find((m) => m.accountId === wanted) ?? memberships[0];

  return {
    user,
    memberships,
    account: active.account,
    role: active.role,
    /** Owners and admins manage the account; plain members only contribute. */
    isManager: active.role !== "MEMBER",
    db: dbFor(user.id),
  };
});

export type Ctx = Awaited<ReturnType<typeof requireContext>>;
