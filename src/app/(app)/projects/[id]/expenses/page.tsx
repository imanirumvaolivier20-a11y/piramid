import { Banknote, Hammer, Package, Receipt, Stamp, Truck, Users, Wrench } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState, Fab } from "@/components/ui";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatMoney } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Money · Pyramid" };

const categoryIcons: Record<ExpenseCategory, typeof Receipt> = {
  MATERIALS: Package,
  SALARIES: Users,
  LABOR: Hammer,
  TRANSPORT: Truck,
  EQUIPMENT: Wrench,
  PERMITS: Stamp,
  OTHER: Banknote,
};

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
    <>
      <div className="mb-4 rounded-2xl bg-zinc-50 p-5 text-center">
        <p className="text-sm text-zinc-500">Expenses so far</p>
        <p className="mt-1 text-3xl font-semibold">{formatMoney(total, currency)}</p>
        <p className="mt-1 text-xs text-zinc-500">Wages are counted on the Home tab.</p>
      </div>

      {expenses.length === 0 ? (
        <EmptyState title="No expenses yet">{can.expense ? "Tap + to log one." : undefined}</EmptyState>
      ) : (
        <ul>
          {expenses.map((expense) => {
            const Icon = categoryIcons[expense.category];
            return (
              <li key={expense.id} className="flex items-center gap-3 border-b border-zinc-100 py-3 last:border-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">{expense.note ?? expenseCategoryLabels[expense.category]}</p>
                  <p className="truncate text-sm text-zinc-500">
                    {expenseCategoryLabels[expense.category]} · {formatDate(expense.date)} · {expense.account.name}
                    {expense.receiptKey && (
                      <>
                        {" · "}
                        <a href={`/api/files/${expense.receiptKey}`} target="_blank" rel="noreferrer" className="text-amber-700 underline">
                          Receipt
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-zinc-900">{formatMoney(expense.amount, currency)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {can.expense && <Fab href={`/projects/${id}/expenses/new`} label="Log an expense" />}
    </>
  );
}
