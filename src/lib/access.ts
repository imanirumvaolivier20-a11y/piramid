import { cache } from "react";
import { notFound } from "next/navigation";
import type { ProjectRole } from "@/generated/prisma/enums";
import type { Ctx } from "@/lib/session";

/**
 * Resolves how the current user relates to a project and what they may do.
 * Calls notFound() when they have no access at all.
 *
 * - OWNER: member of the account that owns the project
 * - CONTRACTOR: member of the hired company/engineer account
 * - WORKER: a roster worker assigned to the project
 *
 * Deciding on a material request is per request: see `manages(toAccountId)`.
 */
export const getProjectAccess = cache(async (ctx: Ctx, projectId: string) => {
  const project = await ctx.db.project.findUnique({
    where: { id: projectId },
    include: {
      account: { include: { type: true, owner: { select: { image: true } } } },
      contracts: {
        where: { status: { in: ["PENDING", "ACTIVE"] } },
        include: { contractor: { include: { type: true, owner: { select: { image: true } } } } },
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
  let workerRole: ProjectRole | null = null;

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
    workerRole = assignment.role;
  }
  const reportsAsWorker = workerRole === "ENGINEER" || workerRole === "FOREMAN";
  const receivesAsWorker = reportsAsWorker || workerRole === "STORE_KEEPER";

  // A contractor only works on the project once the hire is accepted.
  const working = level === "OWNER" || (level === "CONTRACTOR" && contract?.status === "ACTIVE");
  const activeContract = contract?.status === "ACTIVE" ? contract : null;

  /** True when the user is an owner or admin of the account. */
  const manages = (accountId: string) => {
    const role = roleIn(accountId);
    return role !== null && role !== "MEMBER";
  };

  // Who a material request can be sent to: the project owner, or the hired company/engineer.
  const recipients = [
    { accountId: project.accountId, name: project.account.name, label: "Project owner" },
    ...(activeContract
      ? [{ accountId: activeContract.contractorAccountId, name: activeContract.contractor.name, label: "Hired company / engineer" }]
      : []),
  ];

  return {
    project,
    contract,
    level,
    actingAccountId,
    workerRole,
    recipients,
    manages,
    can: {
      report: working || reportsAsWorker,
      expense: working && isManager,
      team: working && isManager,
      viewMoney: level !== "WORKER",
      requestMaterials: working || level === "WORKER",
      receiveMaterials: working || receivesAsWorker,
      hire: level === "OWNER" && isManager && !contract,
      endContract: level === "OWNER" && isManager && !!contract,
      respond: level === "CONTRACTOR" && isManager && contract?.status === "PENDING",
    },
  };
});

export type ProjectAccess = Awaited<ReturnType<typeof getProjectAccess>>;
