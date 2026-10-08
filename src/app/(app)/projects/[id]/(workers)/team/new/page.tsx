import { redirect } from "next/navigation";
import { addWorkerToProject, assignWorker } from "@/actions/workers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { projectRoleLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Add worker · Pyramid" };

function RoleSelect() {
  return (
    <Field label="Role on this project">
      <select name="role" required defaultValue="BUILDER" className={inputClass}>
        {Object.entries(projectRoleLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export default async function AddWorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  if (!access.can.team) redirect(`/projects/${id}/team`);

  const [categories, available] = await Promise.all([
    ctx.db.workerCategory.findMany({ where: { accountId: access.actingAccountId }, orderBy: { createdAt: "asc" } }),
    // People already working for the account on other projects.
    ctx.db.worker.findMany({
      where: { accountId: access.actingAccountId, active: true, assignments: { none: { projectId: id } } },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Add a new worker</h2>
        <ActionForm action={addWorkerToProject.bind(null, id)} className="space-y-4">
          <Field label="Full name">
            <input name="name" required autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Phone (optional)">
            <input type="tel" name="phone" inputMode="tel" className={inputClass} />
          </Field>
          <RoleSelect />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select name="categoryId" defaultValue="" className={inputClass}>
                <option value="">None</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            {access.can.viewMoney && (
              <Field label={`Daily rate (${access.project.account.currency})`}>
                <input type="number" name="dailyRate" min={0} step="any" inputMode="decimal" placeholder="From category" className={inputClass} />
              </Field>
            )}
          </div>
          <SubmitButton className="w-full">Add to project</SubmitButton>
        </ActionForm>
      </section>

      {available.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Or add someone who already works for you</h2>
          <p className="mb-3 text-sm text-zinc-500">They are on your other projects.</p>
          <ActionForm action={assignWorker.bind(null, id)} className="space-y-4">
            <Field label="Worker">
              <select name="workerId" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Choose a worker
                </option>
                {available.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.name}
                    {worker.category && ` (${worker.category.name})`}
                  </option>
                ))}
              </select>
            </Field>
            <RoleSelect />
            <SubmitButton variant="secondary" className="w-full">
              Add to project
            </SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
