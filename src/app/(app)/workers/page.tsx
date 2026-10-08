import { ArrowLeft, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addCategory, removeCategory, removeWorker, setCategoryRate } from "@/actions/workers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MenuAction, MoreMenu } from "@/components/menu";
import { Avatar, EmptyState, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Workers and daily rates · Pyramid" };

/** Account-wide settings for workers: categories and their daily rates, and everyone employed. */
export default async function WorkersPage() {
  const ctx = await requireContext();
  const { account } = ctx;
  if (!account.type.canManageWorkers || !ctx.isManager) redirect("/settings");

  const [workers, categories] = await Promise.all([
    ctx.db.worker.findMany({
      where: { accountId: account.id, active: true },
      include: { category: true, assignments: { include: { project: true } } },
      orderBy: { name: "asc" },
    }),
    ctx.db.workerCategory.findMany({
      where: { accountId: account.id },
      include: { _count: { select: { workers: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-2">
        <Link href="/settings" aria-label="Back to account" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">Workers and daily rates</h1>
      </div>

      <section>
        <h2 className="font-semibold">Daily rates by category</h2>
        <p className="mb-3 text-sm text-zinc-500">What a full day of attendance earns ({account.currency}), unless a worker has a personal rate.</p>
        <ul className="rounded-2xl bg-zinc-50 px-4">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-2 border-b border-zinc-100 py-2 last:border-0">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">
                {category.name}
                <span className="font-normal text-zinc-500"> · {category._count.workers}</span>
              </p>
              <form action={setCategoryRate.bind(null, category.id)} className="flex items-center gap-1">
                <input
                  type="number"
                  name="dailyRate"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder="Rate"
                  aria-label={`Daily rate for ${category.name}`}
                  defaultValue={category.dailyRate ? Number(category.dailyRate) : ""}
                  className={`${inputClass} w-28 py-1.5`}
                />
                <button type="submit" className="rounded-full px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50">
                  Save
                </button>
              </form>
              <form action={removeCategory.bind(null, category.id)}>
                <button type="submit" aria-label={`Remove ${category.name}`} className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm key={categories.length} action={addCategory} className="mt-3 flex items-start gap-2">
          <input name="name" required placeholder="New category, e.g. Electrician" aria-label="New category name" className={`${inputClass} min-w-0 flex-1`} />
          <SubmitButton variant="secondary">Add</SubmitButton>
        </ActionForm>
      </section>

      <section>
        <h2 className="font-semibold">Everyone working for {account.name}</h2>
        <p className="mb-3 text-sm text-zinc-500">Add workers from a project&apos;s Workers tab.</p>
        {workers.length === 0 ? (
          <EmptyState title="No workers yet" />
        ) : (
          <ul>
            {workers.map((worker) => (
              <li key={worker.id} className="flex items-center gap-3 border-b border-zinc-100 py-3 last:border-0">
                <Avatar src={null} name={worker.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{worker.name}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {[
                      worker.category?.name,
                      worker.dailyRate !== null && `${formatMoney(Number(worker.dailyRate), account.currency)}/day`,
                      worker.assignments.map((a) => a.project.name).join(", ") || "No project",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <MoreMenu label={`Options for ${worker.name}`}>
                  <MenuAction action={removeWorker.bind(null, worker.id)} danger icon={<UserMinus className="h-4 w-4" />}>
                    Remove from all projects
                  </MenuAction>
                </MoreMenu>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
