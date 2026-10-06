import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { buildStock, requestTotal } from "@/lib/materials";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Summary · Pyramid" };

/** Everything the project has cost so far, in one place. */
export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, contract, can } = await getProjectAccess(ctx, id);
  if (!can.viewMoney) redirect(`/projects/${id}`);
  const currency = project.account.currency;
  const money = (amount: number) => formatMoney(amount, currency);

  const [expenses, wages, requests, used] = await Promise.all([
    ctx.db.expense.findMany({ where: { projectId: id }, include: { account: true } }),
    ctx.db.dailyReportWage.findMany({ where: { report: { projectId: id } }, include: { report: { include: { account: true } } } }),
    ctx.db.materialRequest.findMany({ where: { projectId: id }, include: { items: true } }),
    ctx.db.dailyReportMaterial.findMany({ where: { report: { projectId: id } } }),
  ]);

  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + Number(expense.amount));
  }
  const materials = byCategory.get("MATERIALS") ?? 0;
  const salaries = byCategory.get("SALARIES") ?? 0;
  const wagesTotal = wages.reduce((sum, wage) => sum + Number(wage.amount), 0);
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const otherExpenses = expensesTotal - materials - salaries;
  const spent = expensesTotal + wagesTotal;

  const stock = buildStock(
    requests.filter((r) => r.status === "RECEIVED").flatMap((r) => r.items),
    used,
  );
  const usedValue = stock.reduce((sum, row) => sum + (row.usedValue ?? 0), 0);
  const stockValue = stock.reduce((sum, row) => sum + (row.remainingValue ?? 0), 0);

  // Approved but not yet delivered: money that is committed but not yet spent.
  const committed = requests
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + requestTotal(r.items).total, 0);
  const waiting = requests.filter((r) => r.status === "SUBMITTED");

  // Who paid what: expenses by their account, wages by the reporting account.
  const paidBy = new Map<string, { name: string; amount: number }>();
  const addPaid = (account: { id: string; name: string }, amount: number) => {
    const entry = paidBy.get(account.id) ?? { name: account.name, amount: 0 };
    entry.amount += amount;
    paidBy.set(account.id, entry);
  };
  expenses.forEach((expense) => addPaid(expense.account, Number(expense.amount)));
  wages.forEach((wage) => addPaid(wage.report.account, Number(wage.amount)));

  const budget = contract?.agreedBudget ? Number(contract.agreedBudget) : null;

  const lines = [
    { label: "Materials bought", amount: materials, hint: "Received material requests and materials expenses" },
    { label: "Wages", amount: wagesTotal, hint: "From daily reports" },
    { label: "Salaries", amount: salaries, hint: "Salary expenses" },
    { label: "Other expenses", amount: otherExpenses, hint: "Transport, equipment, permits, other labor…" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lines.map((line) => (
          <Card key={line.label}>
            <p className="text-sm text-zinc-500">{line.label}</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{money(line.amount)}</p>
            <p className="mt-1 text-xs text-zinc-500">{line.hint}</p>
          </Card>
        ))}
      </div>

      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Total spent on this project</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">{money(spent)}</p>
        </div>
        {budget !== null && (
          <div className="min-w-48 flex-1 sm:max-w-xs">
            <div className="flex justify-between text-sm text-zinc-600">
              <span>Agreed budget {money(budget)}</span>
              <span>{Math.round((spent / budget) * 100)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full rounded-full ${spent > budget ? "bg-red-600" : "bg-amber-500"}`}
                style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }}
              />
            </div>
            <p className={`mt-1 text-sm ${spent > budget ? "font-medium text-red-700" : "text-zinc-600"}`}>
              {spent > budget ? `${money(spent - budget)} over budget` : `${money(budget - spent)} left`}
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Materials</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Value of materials used" value={money(usedValue)} hint="Used quantities in daily reports × average price paid" />
            <Row label="Value still in stock" value={money(stockValue)} />
            <Row label="Approved, not yet delivered" value={money(committed)} />
            <Row label="Requests waiting for approval" value={String(waiting.length)} />
          </dl>
          <Link href={`/projects/${id}/materials`} className="mt-3 inline-block text-sm font-medium text-amber-700 underline">
            Requests and stock
          </Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Expenses by category</h2>
          <dl className="space-y-2 text-sm">
            {Object.entries(expenseCategoryLabels).map(([category, label]) => (
              <Row key={category} label={label} value={money(byCategory.get(category as ExpenseCategory) ?? 0)} />
            ))}
            <Row label="Wages (daily reports)" value={money(wagesTotal)} />
          </dl>
        </Card>

        {paidBy.size > 1 && (
          <Card>
            <h2 className="mb-3 font-semibold">Paid by</h2>
            <dl className="space-y-2 text-sm">
              {[...paidBy.values()].map((entry) => (
                <Row key={entry.name} label={entry.name} value={money(entry.amount)} />
              ))}
            </dl>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2 last:border-0">
      <dt className="text-zinc-600">
        {label}
        {hint && <span className="block text-xs text-zinc-400">{hint}</span>}
      </dt>
      <dd className="shrink-0 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
