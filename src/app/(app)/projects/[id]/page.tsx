import Link from "next/link";
import { Card, buttonClass } from "@/components/ui";
import type { ExpenseCategory } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatMoney, formatQuantity, fromDateInput, toDateInput } from "@/lib/format";
import { expenseCategoryLabels } from "@/lib/labels";
import { buildStock, requestTotal } from "@/lib/materials";
import { projectWages } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Summary · Pyramid" };

/**
 * The page a project opens on: what needs doing, what it has cost so far,
 * and the latest reports. People who cannot see money get the same page
 * without amounts.
 */
export default async function ProjectSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  const { project, contract, can } = access;
  const base = `/projects/${id}`;
  const money = (amount: number) => formatMoney(amount, project.account.currency);

  const today = fromDateInput(toDateInput(new Date()));
  const [expenses, wages, attendance, requests, used, latestReports, reportCount, myTeam, markedToday] = await Promise.all([
    can.viewMoney ? ctx.db.expense.findMany({ where: { projectId: id }, include: { account: true } }) : Promise.resolve([]),
    can.viewMoney
      ? ctx.db.dailyReportWage.findMany({ where: { report: { projectId: id } }, include: { report: { include: { account: true } } } })
      : Promise.resolve([]),
    can.viewMoney ? ctx.db.attendance.findMany({ where: { projectId: id }, include: { account: true } }) : Promise.resolve([]),
    ctx.db.materialRequest.findMany({ where: { projectId: id }, include: { items: true }, orderBy: { number: "asc" } }),
    ctx.db.dailyReportMaterial.findMany({ where: { report: { projectId: id } } }),
    ctx.db.dailyReport.findMany({
      where: { projectId: id },
      include: { createdBy: true, _count: { select: { photos: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    ctx.db.dailyReport.count({ where: { projectId: id } }),
    can.attendance
      ? ctx.db.projectMember.count({ where: { projectId: id, accountId: access.actingAccountId, worker: { active: true } } })
      : Promise.resolve(0),
    can.attendance
      ? ctx.db.attendance.count({ where: { projectId: id, accountId: access.actingAccountId, date: today } })
      : Promise.resolve(0),
  ]);

  // ── What needs the user's attention ──
  const toDecide = requests.filter((r) => r.status === "SUBMITTED" && access.manages(r.toAccountId));
  const toReceive = requests.filter(
    (r) => r.status === "APPROVED" && (can.receiveMaterials || access.manages(r.toAccountId)),
  );
  const attention = [
    ...(myTeam > 0 && markedToday === 0
      ? [{ id: "attendance", href: `${base}/attendance`, text: "Record today's attendance" }]
      : []),
    ...toDecide.map((r) => ({ id: r.id, href: `${base}/materials/${r.id}`, text: `Approve or reject material request #${r.number}` })),
    ...toReceive.map((r) => ({ id: r.id, href: `${base}/materials/${r.id}`, text: `Confirm delivery of material request #${r.number}` })),
  ];

  // ── Money ──
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + Number(expense.amount));
  }
  const materials = byCategory.get("MATERIALS") ?? 0;
  const salaries = byCategory.get("SALARIES") ?? 0;
  // Attendance replaces daily-report wage lines for the days it covers.
  const wagesTotal = projectWages(wages, attendance).total;
  const expensesTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const otherExpenses = expensesTotal - materials - salaries;
  const spent = expensesTotal + wagesTotal;
  const budget = contract?.agreedBudget ? Number(contract.agreedBudget) : null;

  // Who paid what: expenses by their account, wages by the reporting account.
  const paidBy = new Map<string, { name: string; amount: number }>();
  const addPaid = (account: { id: string; name: string }, amount: number) => {
    const entry = paidBy.get(account.id) ?? { name: account.name, amount: 0 };
    entry.amount += amount;
    paidBy.set(account.id, entry);
  };
  expenses.forEach((expense) => addPaid(expense.account, Number(expense.amount)));
  const attended = new Set(attendance.map((a) => `${a.accountId}|${a.date.getTime()}`));
  wages
    .filter((wage) => !attended.has(`${wage.report.accountId}|${wage.report.date.getTime()}`))
    .forEach((wage) => addPaid(wage.report.account, Number(wage.amount)));
  attendance.forEach((day) => addPaid(day.account, Number(day.amount)));

  // ── Materials ──
  const stock = buildStock(
    requests.filter((r) => r.status === "RECEIVED").flatMap((r) => r.items),
    used,
  );
  const usedValue = stock.reduce((sum, row) => sum + (row.usedValue ?? 0), 0);
  const stockValue = stock.reduce((sum, row) => sum + (row.remainingValue ?? 0), 0);
  const committed = requests.filter((r) => r.status === "APPROVED").reduce((sum, r) => sum + requestTotal(r.items).total, 0);
  const openRequests = requests.filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED").length;
  const inStock = stock.filter((row) => row.remaining > 0);

  const lines = [
    { label: "Materials bought", amount: materials, href: `${base}/materials` },
    { label: "Wages", amount: wagesTotal, href: `${base}/attendance` },
    { label: "Salaries", amount: salaries, href: `${base}/expenses` },
    { label: "Other expenses", amount: otherExpenses, href: `${base}/expenses` },
  ];

  const actions = [
    can.report && { href: `${base}/reports/new`, label: "New daily report", primary: true },
    can.attendance && myTeam > 0 && { href: `${base}/attendance`, label: "Attendance", primary: false },
    can.requestMaterials && { href: `${base}/materials/new`, label: "Request materials", primary: !can.report },
    can.expense && { href: `${base}/expenses`, label: "Log an expense", primary: false },
  ].filter((action) => !!action);

  return (
    <div className="space-y-5">
      {actions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={action.primary ? buttonClass.primary : buttonClass.secondary}>
              {action.label}
            </Link>
          ))}
        </div>
      )}

      {attention.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-950">Needs your attention</h2>
          <ul className="mt-2 space-y-1">
            {attention.map((item) => (
              <li key={item.id + item.text}>
                <Link href={item.href} className="text-sm font-medium text-amber-900 underline">
                  {item.text}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {can.viewMoney && (
        <>
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

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {lines.map((line) => (
              <Link key={line.label} href={line.href} className="block">
                <Card className="h-full hover:border-amber-400">
                  <p className="text-sm text-zinc-500">{line.label}</p>
                  <p className="mt-1 text-lg font-semibold text-zinc-900 sm:text-xl">{money(line.amount)}</p>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Latest reports</h2>
            <Link href={`${base}/activity`} className="text-sm font-medium text-amber-700 underline">
              All activity ({reportCount})
            </Link>
          </div>
          {latestReports.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No daily reports yet.
              {can.report && (
                <>
                  {" "}
                  <Link href={`${base}/reports/new`} className="underline">
                    Write the first one
                  </Link>
                  .
                </>
              )}
            </p>
          ) : (
            <ul className="space-y-3">
              {latestReports.map((report) => (
                <li key={report.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs text-zinc-500">
                    {formatDate(report.date)} · {report.createdBy.name ?? report.createdBy.email}
                    {report._count.photos > 0 && ` · ${report._count.photos} photo${report._count.photos === 1 ? "" : "s"}`}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-zinc-800">{report.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Materials</h2>
            <Link href={`${base}/materials`} className="text-sm font-medium text-amber-700 underline">
              Requests and stock
            </Link>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Open requests" value={String(openRequests)} />
            {can.viewMoney && (
              <>
                <Row label="Value of materials used" value={money(usedValue)} hint="Used in daily reports × average price paid" />
                <Row label="Value still in stock" value={money(stockValue)} />
                <Row label="Approved, not yet delivered" value={money(committed)} />
              </>
            )}
          </dl>
          {inStock.length > 0 && (
            <p className="mt-3 text-sm text-zinc-600">
              <span className="font-medium text-zinc-800">In stock: </span>
              {inStock
                .slice(0, 6)
                .map((row) => `${row.name} ${formatQuantity(row.remaining)} ${row.unit}`)
                .join(" · ")}
              {inStock.length > 6 && " …"}
            </p>
          )}
        </Card>

        {can.viewMoney && (
          <Card>
            <h2 className="mb-3 font-semibold">Spending by category</h2>
            <dl className="space-y-2 text-sm">
              {Object.entries(expenseCategoryLabels)
                .filter(([category]) => (byCategory.get(category as ExpenseCategory) ?? 0) > 0)
                .map(([category, label]) => (
                  <Row key={category} label={label} value={money(byCategory.get(category as ExpenseCategory) ?? 0)} />
                ))}
              <Row label="Wages (attendance and daily reports)" value={money(wagesTotal)} />
            </dl>
          </Card>
        )}

        {can.viewMoney && paidBy.size > 1 && (
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
