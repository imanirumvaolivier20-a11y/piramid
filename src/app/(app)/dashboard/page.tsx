import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { engagementModels, projectRoleLabels, projectStatusLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Projects · Pyramid" };

export default async function DashboardPage() {
  const ctx = await requireContext();
  const { account } = ctx;

  const [owned, hires, assignments, toApprove] = await Promise.all([
    ctx.db.project.findMany({
      where: { accountId: account.id },
      include: {
        _count: { select: { reports: true } },
        contracts: { where: { status: { in: ["PENDING", "ACTIVE"] } }, include: { contractor: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.contract.findMany({
      where: { contractorAccountId: account.id, status: { in: ["PENDING", "ACTIVE"] } },
      include: { project: true, owner: true },
      orderBy: { createdAt: "desc" },
    }),
    ctx.db.projectMember.findMany({
      where: { worker: { userId: ctx.user.id } },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    ctx.isManager
      ? ctx.db.materialRequest.findMany({
          where: { toAccountId: account.id, status: "SUBMITTED" },
          include: { project: true, requestedBy: true, _count: { select: { items: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const canCreate = account.type.canOwnProjects && ctx.isManager;
  const nothing = owned.length === 0 && hires.length === 0 && assignments.length === 0;

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${account.name} · ${account.type.label}`}
        action={
          canCreate && (
            <Link href="/projects/new" className={buttonClass.primary}>
              New project
            </Link>
          )
        }
      />

      {nothing && (
        <EmptyState title="No projects yet">
          {canCreate
            ? "Create your first project to start its activity history."
            : account.type.canBeHired
              ? "Projects appear here when an owner hires you."
              : "Projects appear here when a company assigns you to one."}
        </EmptyState>
      )}

      {toApprove.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Material requests waiting for you</h2>
          <ul className="divide-y divide-zinc-200 rounded-xl border border-amber-300 bg-white">
            {toApprove.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/projects/${request.projectId}/materials/${request.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-zinc-50"
                >
                  <span className="text-zinc-900">
                    <strong>{request.project.name}</strong> · #{request.number} · {request._count.items}{" "}
                    {request._count.items === 1 ? "item" : "items"} from {request.requestedBy.name ?? request.requestedBy.email}
                  </span>
                  <span className="text-zinc-500">{formatDate(request.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hires.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Hired on</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {hires.map((contract) => (
              <li key={contract.id}>
                <Link href={`/projects/${contract.projectId}`} className="block">
                  <Card className="hover:border-amber-400">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900">{contract.project.name}</h3>
                      {contract.status === "PENDING" ? (
                        <Badge tone="amber">Respond to request</Badge>
                      ) : (
                        <Badge tone="green">Active</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      For {contract.owner.name} · {engagementModels[contract.engagementModel].label}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {owned.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Your projects</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {owned.map((project) => {
              const contract = project.contracts[0];
              return (
                <li key={project.id}>
                  <Link href={`/projects/${project.id}`} className="block">
                    <Card className="hover:border-amber-400">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-zinc-900">{project.name}</h3>
                        <Badge tone={project.status === "ACTIVE" ? "green" : "neutral"}>
                          {projectStatusLabels[project.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600">
                        {[project.location, project.startDate && `Started ${formatDate(project.startDate)}`]
                          .filter(Boolean)
                          .join(" · ") || "No location set"}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        {project._count.reports} daily {project._count.reports === 1 ? "report" : "reports"}
                        {contract && ` · ${contract.contractor.name}${contract.status === "PENDING" ? " (awaiting response)" : ""}`}
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {assignments.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Assigned to you</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {assignments.map((assignment) => (
              <li key={assignment.id}>
                <Link href={`/projects/${assignment.projectId}`} className="block">
                  <Card className="hover:border-amber-400">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-zinc-900">{assignment.project.name}</h3>
                      <Badge tone="blue">{projectRoleLabels[assignment.role]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{assignment.project.location ?? "No location set"}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
