import { PayLedger } from "@/components/pay-ledger";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { buildLedger, dailyRateOf, payCycleLabels } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "My pay · Pyramid" };

/** For workers: the days they were recorded and what each employer has paid and still owes them. */
export default async function MyPayPage() {
  const ctx = await requireContext();

  const links = await ctx.db.worker.findMany({
    where: { userId: ctx.user.id },
    include: {
      account: true,
      category: true,
      attendance: { include: { project: true } },
      payments: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-2">
        <Link href="/settings" aria-label="Back to account" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">My pay</h1>
          <p className="text-sm text-zinc-500">On all your projects</p>
        </div>
      </div>

      {links.length === 0 && (
        <EmptyState title="No employer has added you yet">
          Ask your company to add you to its roster with the email {ctx.user.email}.
        </EmptyState>
      )}

      <div className="space-y-8">
        {links.map((worker) => {
          const ledger = buildLedger(worker.attendance, worker.payments, worker.account.payCycle);
          const rate = dailyRateOf(worker);
          const money = (amount: number) => formatMoney(amount, worker.account.currency);
          return (
            <section key={worker.id}>
              <Card className="mb-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{worker.account.name}</h2>
                    <p className="text-sm text-zinc-600">
                      {[worker.category?.name, rate !== null && `${money(rate)} per day`, payCycleLabels[worker.account.payCycle]]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Owed to you</p>
                    <p className={`text-2xl font-semibold ${ledger.owed > 0 ? "text-amber-700" : "text-zinc-900"}`}>
                      {money(Math.max(ledger.owed, 0))}
                    </p>
                  </div>
                </div>
              </Card>
              <PayLedger ledger={ledger} currency={worker.account.currency} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
