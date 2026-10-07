import Link from "next/link";
import { redirect } from "next/navigation";
import { addCategory, addWorker, removeCategory, removeWorker, setCategoryRate } from "@/actions/workers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, EmptyState, Field, PageHeader, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Workers · Pyramid" };

export default async function WorkersPage() {
  const ctx = await requireContext();
  const { account } = ctx;
  if (!account.type.canManageWorkers) redirect("/dashboard");

  const [workers, categories] = await Promise.all([
    ctx.db.worker.findMany({
      where: { accountId: account.id, active: true },
      include: { category: true, _count: { select: { assignments: true } } },
      orderBy: { name: "asc" },
    }),
    ctx.db.workerCategory.findMany({
      where: { accountId: account.id },
      include: { _count: { select: { workers: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="Workers" subtitle={`Roster of ${account.name}. Assign workers to a project from its Team tab.`} />

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        {ctx.isManager && (
          <Card className="self-start">
            <h2 className="mb-3 font-semibold">Add a worker</h2>
            <ActionForm key={workers.length} action={addWorker} className="space-y-3">
              <Field label="Name">
                <input name="name" required className={inputClass} />
              </Field>
              <Field label="Category">
                <select name="categoryId" defaultValue="" className={inputClass}>
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phone">
                <input type="tel" name="phone" className={inputClass} />
              </Field>
              <Field label="Email" hint="If they sign in to Pyramid with this email, they will see their projects.">
                <input type="email" name="email" className={inputClass} />
              </Field>
              <SubmitButton className="w-full">Add worker</SubmitButton>
            </ActionForm>
          </Card>
        )}

        <div className={`space-y-6 ${ctx.isManager ? "" : "lg:col-span-2"}`}>
          <section>
            <h2 className="mb-3 font-semibold">Roster ({workers.length})</h2>
            {workers.length === 0 ? (
              <EmptyState title="No workers yet" />
            ) : (
              <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
                {workers.map((worker) => (
                  <li key={worker.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">
                        {ctx.isManager ? (
                          <Link href={`/workers/${worker.id}`} className="underline-offset-2 hover:underline">
                            {worker.name}
                          </Link>
                        ) : (
                          worker.name
                        )}{" "}
                        {worker.userId && <Badge tone="green">Has login</Badge>}
                      </p>
                      <p className="truncate text-zinc-500">
                        {[
                          worker.category?.name,
                          worker.dailyRate !== null && `${formatMoney(Number(worker.dailyRate), account.currency)}/day`,
                          worker.phone,
                          worker.email,
                          `${worker._count.assignments} ${worker._count.assignments === 1 ? "project" : "projects"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {ctx.isManager && (
                      <form action={removeWorker.bind(null, worker.id)}>
                        <button type="submit" className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Remove ${worker.name}`}>
                          ✕
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-semibold">Worker categories</h2>
            <p className="mb-3 text-sm text-zinc-600">
              Daily rates (in {account.currency}) set what attendance earns, unless a worker has a personal rate. They also
              pre-fill the wage lines of daily reports.
            </p>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
              {categories.map((category) => (
                <li key={category.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <p className="font-medium text-zinc-900">
                    {category.name}{" "}
                    <span className="font-normal text-zinc-500">
                      · {category._count.workers} {category._count.workers === 1 ? "worker" : "workers"}
                    </span>
                  </p>
                  {ctx.isManager && (
                    <div className="flex items-center gap-2">
                      <form action={setCategoryRate.bind(null, category.id)} className="flex items-center gap-2">
                        <input
                          type="number"
                          name="dailyRate"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          placeholder="Daily rate"
                          aria-label={`Daily rate for ${category.name}`}
                          defaultValue={category.dailyRate ? Number(category.dailyRate) : ""}
                          className={`${inputClass} w-32 py-1.5`}
                        />
                        <button type="submit" className="rounded-lg border border-zinc-300 px-2 py-1.5 hover:bg-zinc-50">
                          Save
                        </button>
                      </form>
                      <form action={removeCategory.bind(null, category.id)}>
                        <button type="submit" className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-100" aria-label={`Remove ${category.name}`}>
                          ✕
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {ctx.isManager && (
              <ActionForm key={categories.length} action={addCategory} className="mt-3 flex flex-wrap items-start gap-2">
                <input name="name" required placeholder="New category, e.g. Electrician" aria-label="New category name" className={`${inputClass} min-w-0 flex-1`} />
                <SubmitButton variant="secondary">Add category</SubmitButton>
              </ActionForm>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
