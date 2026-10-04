import { cache } from "react";
import { notFound } from "next/navigation";
import type { Ctx } from "@/lib/session";

/**
 * Resolves how the current user relates to a project and what they may do.
 * Calls notFound() when they have no access at all.
 *
 * - OWNER: member of the account that owns the project
 * - CONTRACTOR: member of the hired company/engineer account
 * - WORKER: a roster worker assigned to the project
 */
export const getProjectAccess = cache(async (ctx: Ctx, projectId: string) => {
  const project = await ctx.db.project.findUnique({
    where: { id: projectId },
    include: {
      account: { include: { type: true } },
      contracts: {
        where: { status: { in: ["PENDING", "ACTIVE"] } },
        include: { contractor: { include: { type: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!project) notFound();

  const contract = project.contracts[0] ?? null;
  const roleIn = (accountId: string) =>
    ctx.memberships.find((m) => m.accountId === accountId)?.role ?? null;

  const ownerRole = roleIn(project.accountId);
  const contractorRole = contract ? roleIn(contract.contractorAccountId) : null;

  let level: "OWNER" | "CONTRACTOR" | "WORKER";
  let actingAccountId: string;
  let isManager = false;
  let reportsAsWorker = false;

  if (ownerRole) {
    level = "OWNER";
    actingAccountId = project.accountId;
    isManager = ownerRole !== "MEMBER";
  } else if (contract && contractorRole) {
    level = "CONTRACTOR";
    actingAccountId = contract.contractorAccountId;
    isManager = contractorRole !== "MEMBER";
  } else {
    const assignment = await ctx.db.projectMember.findFirst({
      where: { projectId, worker: { userId: ctx.user.id } },
    });
    if (!assignment) notFound();
    level = "WORKER";
    actingAccountId = assignment.accountId;
    reportsAsWorker = assignment.role === "ENGINEER" || assignment.role === "FOREMAN";
  }

  // A contractor only works on the project once the hire is accepted.
  const working = level === "OWNER" || (level === "CONTRACTOR" && contract?.status === "ACTIVE");

  return {
    project,
    contract,
    level,
    actingAccountId,
    can: {
      report: working || reportsAsWorker,
      expense: working && isManager,
      team: working && isManager,
      viewMoney: level !== "WORKER",
      hire: level === "OWNER" && isManager && !contract,
      endContract: level === "OWNER" && isManager && !!contract,
      respond: level === "CONTRACTOR" && isManager && contract?.status === "PENDING",
    },
  };
});

export type ProjectAccess = Awaited<ReturnType<typeof getProjectAccess>>;
