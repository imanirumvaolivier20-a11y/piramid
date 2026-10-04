import Link from "next/link";
import { assignWorker, unassignWorker } from "@/actions/workers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { projectRoleLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Team · Pyramid" };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { can, actingAccountId } = await getProjectAccess(ctx, id);

  const [members, roster] = await Promise.all([
    ctx.db.projectMember.findMany({
      where: { projectId: id },
      include: { worker: { include: { category: true } }, account: true },
      orderBy: { createdAt: "asc" },
    }),
    can.team
      ? ctx.db.worker.findMany({
          where: { accountId: actingAccountId, active: true },
          include: { category: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      {can.team && (
        <Card className="self-start">
          <h2 className="mb-3 font-semibold">Assign a worker</h2>
          {roster.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Your roster is empty.{" "}
              <Link href="/workers" className="font-medium text-amber-700 underline">
                Add workers
              </Link>{" "}
              first.
            </p>
          ) : (
            <ActionForm action={assignWorker.bind(null, id)} className="space-y-3">
              <Field label="Worker" hint="From your account's roster.">
                <select name="workerId" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Choose a worker
                  </option>
                  {roster.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.name}
                      {worker.category && ` (${worker.category.name})`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Role on this project">
                <select name="role" required defaultValue="BUILDER" className={inputClass}>
                  {Object.entries(projectRoleLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <SubmitButton className="w-full">Assign to project</SubmitButton>
            </ActionForm>
          )}
        </Card>
      )}

      <section className={can.team ? "" : "lg:col-span-2"}>
        <h2 className="mb-3 font-semibold">Project team</h2>
        {members.length === 0 ? (
          <EmptyState title="No workers assigned yet" />
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{member.worker.name}</p>
                  <p className="text-zinc-500">
                    {[member.worker.category?.name, member.worker.phone, member.account.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="blue">{projectRoleLabels[member.role]}</Badge>
                  {can.team && member.accountId === actingAccountId && (
                    <form action={unassignWorker.bind(null, id, member.id)}>
                      <button type="submit" className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Remove ${member.worker.name}`}>
                        ✕
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
