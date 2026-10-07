import Link from "next/link";
import { redirect } from "next/navigation";
import { recordPayment, setPayCycle } from "@/actions/payroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, EmptyState, PageHeader, buttonClass, inputClass } from "@/components/ui";
import type { PayCycle } from "@/generated/prisma/enums";
import { formatMoney, fromDateInput, toDateInput } from "@/lib/format";
import { nextPeriod, payCycleLabels, periodFor, periodKey, periodLabel, previousPeriod } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Payroll · Pyramid" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const ctx = await requireContext();
  const { account } = ctx;
  if (!account.type.canManageWorkers) redirect("/dashboard");
  const money = (amount: number) => formatMoney(amount, account.currency);

  if (!ctx.isManager) {
    return (
      <>
        <PageHeader title="Payroll" />
        <EmptyState title="Only owners and admins can see payroll">Ask the owner of {account.name} for access.</EmptyState>
      </>
    );
  }

  const cycle: PayCycle = account.payCycle;
  const current = periodFor(new Date(), cycle);
  const wanted = (await searchParams).period;
  const period = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) ? periodFor(fromDateInput(wanted), cycle) : current;
  const isCurrent = period.start.getTime() === current.start.getTime();

  const [workers, inPeriod, paidInPeriod, earnedAll, paidAll] = await Promise.all([
    ctx.db.worker.findMany({ where: { accountId: account.id }, include: { category: true }, orderBy: { name: "asc" } }),
    ctx.db.attendance.findMany({
      where: { accountId: account.id, date: { gte: period.start, lte: period.end } },
      select: { workerId: true, status: true, amount: true },
    }),
    ctx.db.workerPayment.groupBy({
      by: ["workerId"],
      where: { accountId: account.id, date: { gte: period.start, lte: period.end } },
      _sum: { amount: true },
    }),
    ctx.db.attendance.groupBy({ by: ["workerId"], where: { accountId: account.id }, _sum: { amount: true } }),
    ctx.db.workerPayment.groupBy({ by: ["workerId"], where: { accountId: account.id }, _sum: { amount: true } }),
  ]);

  const sumFor = (groups: { workerId: string; _sum: { amount: { toString(): string } | null } }[], workerId: string) =>
    Number(groups.find((g) => g.workerId === workerId)?._sum.amount ?? 0);

  const rows = workers
    .map((worker) => {
      const records = inPeriod.filter((a) => a.workerId === worker.id);
      const days = records.reduce((sum, a) => sum + (a.status === "PRESENT" ? 1 : a.status === "HALF_DAY" ? 0.5 : 0), 0);
      const earned = records.reduce((sum, a) => sum + Number(a.amount), 0);
      const owed = sumFor(earnedAll, worker.id) - sumFor(paidAll, worker.id);
      return { worker, days, earned, paid: sumFor(paidInPeriod, worker.id), owed };
    })
    // Former workers only stay listed while they are still owed money.
    .filter((row) => row.worker.active || Math.abs(row.owed) > 0.005 || row.days > 0);

  const totals = rows.reduce(
    (sum, row) => ({ earned: sum.earned + row.earned, paid: sum.paid + row.paid, owed: sum.owed + Math.max(row.owed, 0) }),
    { earned: 0, paid: 0, owed: 0 },
  );

  return (
    <>
      <PageHeader title="Payroll" subtitle="Wages are earned from attendance and paid here. The balance is what each worker is owed today." />

      <Card className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/payroll?period=${periodKey(previousPeriod(period, cycle))}`} className={buttonClass.secondary} aria-label="Previous period">
            ←
          </Link>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{isCurrent ? "Current pay period" : "Pay period"}</p>
            <p className="font-semibold">{periodLabel(period)}</p>
          </div>
          {!isCurrent && (
            <Link href={`/payroll?period=${periodKey(nextPeriod(period, cycle))}`} className={buttonClass.secondary} aria-label="Next period">
              →
            </Link>
          )}
          {!isCurrent && (
            <Link href="/payroll" className="text-sm font-medium text-amber-700 underline">
              Back to current
            </Link>
          )}
        </div>
        <form action={setPayCycle} className="flex items-center gap-2">
          <select name="payCycle" defaultValue={cycle} aria-label="Pay cycle" className={`${inputClass} w-auto py-2`}>
            {Object.entries(payCycleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <SubmitButton variant="secondary">Save</SubmitButton>
        </form>
      </Card>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Card>
          <p className="text-sm text-zinc-500">Earned this period</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">{money(totals.earned)}</p>
        </Card>
        <Card>
          <p className="text-sm text-zinc-500">Paid this period</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">{money(totals.paid)}</p>
        </Card>
        <Card className={totals.owed > 0 ? "border-amber-300 bg-amber-50" : ""}>
          <p className="text-sm text-zinc-500">Owed to workers now</p>
          <p className="mt-1 text-lg font-semibold sm:text-xl">{money(totals.owed)}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No workers yet">
          Add workers on the{" "}
          <Link href="/workers" className="underline">
            Workers
          </Link>{" "}
          page and record their attendance on a project.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
          {rows.map(({ worker, days, earned, paid, owed }) => (
            <li key={worker.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <Link href={`/workers/${worker.id}`} className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                  {worker.name}
                </Link>
                {!worker.active && <span className="text-sm text-zinc-500"> (former worker)</span>}
                <p className="text-sm text-zinc-500">
                  {days} {days === 1 ? "day" : "days"} · earned {money(earned)}
                  {paid > 0 && ` · paid ${money(paid)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className={`text-sm ${owed > 0 ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>
                  {owed > 0 ? `Owed ${money(owed)}` : owed < 0 ? `Paid ahead ${money(-owed)}` : "Nothing owed"}
                </p>
                {owed > 0 && (
                  <ActionForm key={`${worker.id}-${owed}`} action={recordPayment.bind(null, worker.id)} className="flex items-center gap-2">
                    <input type="hidden" name="periodStart" value={toDateInput(period.start)} />
                    <input type="hidden" name="periodEnd" value={toDateInput(period.end)} />
                    <input
                      type="number"
                      name="amount"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      defaultValue={Math.round(owed * 100) / 100}
                      aria-label={`Amount to pay ${worker.name}`}
                      className={`${inputClass} w-32 py-2`}
                    />
                    <SubmitButton>Pay</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
