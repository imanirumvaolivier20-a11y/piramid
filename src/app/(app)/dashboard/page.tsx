import Link from "next/link";
import { EmptyState, Fab, ProjectMark } from "@/components/ui";
import { engagementModels, projectRoleLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Projects · Pyramid" };

/** "Today 14:05", "Yesterday", or a short date, like a chat list. */
function when(date: Date) {
  const now = new Date();
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = (day(now) - day(date)) / 86_400_000;
  if (diff === 0) return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (diff === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

type Row = {
  id: string;
  name: string;
  relation: string;
  created: Date;
  pendingHire: boolean;
};

export default async function DashboardPage() {
  const ctx = await requireContext();
  const { account } = ctx;

  const [owned, hires, assignments] = await Promise.all([
    ctx.db.project.findMany({
      where: { accountId: account.id },
      include: { contracts: { where: { status: { in: ["PENDING", "ACTIVE"] } }, include: { contractor: true } } },
    }),
    ctx.db.contract.findMany({
      where: { contractorAccountId: account.id, status: { in: ["PENDING", "ACTIVE"] } },
      include: { project: true, owner: true },
    }),
    ctx.db.projectMember.findMany({ where: { worker: { userId: ctx.user.id } }, include: { project: true } }),
  ]);

  // One row per project, however the user is connected to it.
  const rows = new Map<string, Row>();
  for (const project of owned) {
    const contract = project.contracts[0];
    rows.set(project.id, {
      id: project.id,
      name: project.name,
      relation: contract
        ? contract.status === "PENDING"
          ? `Waiting for ${contract.contractor.name}`
          : `Managed by ${contract.contractor.name}`
        : project.location ?? "Your project",
      created: project.createdAt,
      pendingHire: false,
    });
  }
  for (const contract of hires) {
    if (rows.has(contract.projectId)) continue;
    rows.set(contract.projectId, {
      id: contract.projectId,
      name: contract.project.name,
      relation: `For ${contract.owner.name} · ${engagementModels[contract.engagementModel].label}`,
      created: contract.createdAt,
      pendingHire: contract.status === "PENDING" && ctx.isManager,
    });
  }
  for (const assignment of assignments) {
    if (rows.has(assignment.projectId)) continue;
    rows.set(assignment.projectId, {
      id: assignment.projectId,
      name: assignment.project.name,
      relation: projectRoleLabels[assignment.role],
      created: assignment.createdAt,
      pendingHire: false,
    });
  }
  const ids = [...rows.keys()];

  // The latest thing that happened on each project, and what is waiting on the user.
  const managed = ctx.memberships.filter((m) => m.role !== "MEMBER").map((m) => m.accountId);
  const [latestReports, latestRequests, waiting] = await Promise.all([
    ctx.db.dailyReport.findMany({
      where: { projectId: { in: ids } },
      distinct: ["projectId"],
      orderBy: { createdAt: "desc" },
      include: { createdBy: true },
    }),
    ctx.db.materialRequest.findMany({
      where: { projectId: { in: ids } },
      distinct: ["projectId"],
      orderBy: { createdAt: "desc" },
      include: { requestedBy: true, items: { take: 2, orderBy: { sortOrder: "asc" } } },
    }),
    ctx.db.materialRequest.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, status: "SUBMITTED", toAccountId: { in: managed } },
      _count: true,
    }),
  ]);

  const firstName = (user: { name: string | null; email: string }) => (user.name ?? user.email).split(" ")[0];
  const list = [...rows.values()]
    .map((row) => {
      const report = latestReports.find((r) => r.projectId === row.id);
      const request = latestRequests.find((r) => r.projectId === row.id);
      let at = row.created;
      let preview = row.relation;
      if (report && report.createdAt > at) {
        at = report.createdAt;
        preview = `${firstName(report.createdBy)}: ${report.description}`;
      }
      if (request && request.createdAt > at) {
        at = request.createdAt;
        preview = `${firstName(request.requestedBy)} requested ${request.items.map((i) => i.name).join(", ")}`;
      }
      const count = (waiting.find((w) => w.projectId === row.id)?._count ?? 0) + (row.pendingHire ? 1 : 0);
      return { ...row, at, preview, count };
    })
    .sort((a, b) => b.count - a.count || b.at.getTime() - a.at.getTime());

  const canCreate = account.type.canOwnProjects && ctx.isManager;

  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Projects</h1>

      {list.length === 0 ? (
        <EmptyState title="No projects yet">
          {canCreate
            ? "Tap + to create your first project."
            : account.type.canBeHired
              ? "Projects appear here when an owner hires you."
              : "Projects appear here when a company adds you to one."}
        </EmptyState>
      ) : (
        <ul className="-mx-2">
          {list.map((project) => (
            <li key={project.id}>
              <Link href={`/projects/${project.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-3 hover:bg-zinc-50">
                <ProjectMark name={project.name} />
                <span className="min-w-0 flex-1 border-b border-zinc-100 pb-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold text-zinc-900">{project.name}</span>
                    <span className={`shrink-0 text-xs ${project.count ? "font-semibold text-amber-600" : "text-zinc-400"}`}>
                      {when(project.at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-zinc-500">
                      {project.pendingHire ? "New hire request — tap to respond" : project.preview}
                    </span>
                    {project.count > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-zinc-950">
                        {project.count}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canCreate && <Fab href="/projects/new" label="New project" />}
    </>
  );
}
