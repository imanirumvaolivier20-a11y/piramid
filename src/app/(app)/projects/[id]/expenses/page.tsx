import { redirect } from "next/navigation";
import { addExpense } from "@/actions/expenses";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, Field, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatMoney, toDateInput } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Expenses · Pyramid" };

export default async function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, can } = await getProjectAccess(ctx, id);
  if (!can.viewMoney) redirect(`/projects/${id}`);
  const currency = project.account.currency;

  const expenses = await ctx.db.expense.findMany({
    where: { projectId: id },
    include: { createdBy: true, account: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      {can.expense && (
        <Card className="self-start">
          <h2 className="mb-3 font-semibold">Log an expense</h2>
          {/* Keyed by count so the form resets after a successful save. */}
          <ActionForm key={expenses.length} action={addExpense.bind(null, id)} className="space-y-3">
            <Field label={`Amount (${currency})`}>
              <input type="number" name="amount" required min={0} step="any" inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Category">
              <select name="category" defaultValue="MATERIALS" className={inputClass}>
                {Object.entries(expenseCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" name="date" required defaultValue={toDateInput(new Date())} className={inputClass} />
            </Field>
            <Field label="Note">
              <input name="note" placeholder="What was it for?" className={inputClass} />
            </Field>
            <Field label="Receipt photo (optional)">
              <input type="file" name="receipt" accept="image/*" className="block w-full text-sm" />
            </Field>
            <SubmitButton className="w-full">Save expense</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <section className={can.expense ? "" : "lg:col-span-2"}>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">All expenses</h2>
          <p className="text-sm text-zinc-600">
            Total <strong className="text-zinc-900">{formatMoney(total, currency)}</strong>
          </p>
        </div>

        {expenses.length === 0 ? (
          <EmptyState title="No expenses logged yet" />
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">
                    {expenseCategoryLabels[expense.category]}
                    {expense.note && <span className="font-normal text-zinc-600"> — {expense.note}</span>}
                  </p>
                  <p className="text-zinc-500">
                    {formatDate(expense.date)} · {expense.createdBy.name ?? expense.createdBy.email} ({expense.account.name})
                    {expense.receiptKey && (
                      <>
                        {" · "}
                        <a href={`/api/files/${expense.receiptKey}`} target="_blank" rel="noreferrer" className="underline">
                          Receipt
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-zinc-900">{formatMoney(expense.amount, currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
