import { PayLedger } from "@/components/pay-ledger";
import { EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { buildLedger, dailyRateOf } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "My pay · Pyramid" };

/** The signed-in worker's own days and pay on this project. */
export default async function ProjectMyPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const links = await ctx.db.worker.findMany({
    where: { userId: ctx.user.id, assignments: { some: { projectId: id } } },
    include: {
      account: true,
      category: true,
      attendance: { where: { projectId: id }, include: { project: true } },
      payments: { where: { projectId: id } },
    },
  });
  if (links.length === 0) return <EmptyState title="You are not on this project's team" />;

  return (
    <div className="space-y-6">
      {links.map((worker) => {
        const ledger = buildLedger(worker.attendance, worker.payments, worker.account.payCycle);
        const rate = dailyRateOf(worker);
        const money = (amount: number) => formatMoney(amount, worker.account.currency);
        return (
          <section key={worker.id} className="space-y-4">
            <div className={`rounded-2xl p-5 text-center ${ledger.owed > 0 ? "bg-amber-50" : "bg-zinc-50"}`}>
              <p className="text-sm text-zinc-500">{worker.account.name} owes you</p>
              <p className="mt-1 text-3xl font-semibold">{money(Math.max(ledger.owed, 0))}</p>
              {rate !== null && <p className="mt-1 text-sm text-zinc-500">{money(rate)} per day</p>}
            </div>
            <PayLedger ledger={ledger} currency={worker.account.currency} />
          </section>
        );
      })}
    </div>
  );
}
