import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { recordPayment, setWorkerRate } from "@/actions/payroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PayLedger } from "@/components/pay-ledger";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { formatMoney, toDateInput } from "@/lib/format";
import { buildLedger, dailyRateOf } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Worker · Pyramid" };

/** One worker's pay record: rate, balance owed, payments and attendance by period. */
export default async function WorkerLedgerPage({ params }: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await params;
  const ctx = await requireContext();
  const { account } = ctx;
  if (!account.type.canManageWorkers || !ctx.isManager) redirect("/workers");
  const money = (amount: number) => formatMoney(amount, account.currency);

  const worker = await ctx.db.worker.findFirst({
    where: { id: workerId, accountId: account.id },
    include: {
      category: true,
      assignments: { include: { project: true } },
      attendance: { include: { project: true } },
      payments: true,
    },
  });
  if (!worker) notFound();

  const ledger = buildLedger(worker.attendance, worker.payments, account.payCycle);
  const rate = dailyRateOf(worker);
  const earned = worker.attendance.reduce((sum, a) => sum + Number(a.amount), 0);
  const paid = worker.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/payroll" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← Payroll
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{worker.name}</h1>
            <p className="text-sm text-zinc-600">
              {[worker.category?.name, worker.phone, worker.email].filter(Boolean).join(" · ") || "No details"}
            </p>
            {worker.assignments.length > 0 && (
              <p className="mt-1 text-sm text-zinc-600">On {worker.assignments.map((a) => a.project.name).join(", ")}</p>
            )}
          </div>
          {!worker.active && <Badge>Former worker</Badge>}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Earned</dt>
            <dd className="font-semibold">{money(earned)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Paid</dt>
            <dd className="font-semibold">{money(paid)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Owed now</dt>
            <dd className={`font-semibold ${ledger.owed > 0 ? "text-amber-700" : ""}`}>{money(ledger.owed)}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Record a payment</h2>
          <ActionForm key={worker.payments.length} action={recordPayment.bind(null, worker.id)} className="mt-3 space-y-3">
            <Field label={`Amount (${account.currency})`}>
              <input
                type="number"
                name="amount"
                required
                min={0}
                step="any"
                inputMode="decimal"
                defaultValue={ledger.owed > 0 ? Math.round(ledger.owed * 100) / 100 : ""}
                className={inputClass}
              />
            </Field>
            <Field label="Date">
              <input type="date" name="date" required defaultValue={toDateInput(new Date())} className={inputClass} />
            </Field>
            <Field label="Note (optional)">
              <input name="note" placeholder="e.g. Cash, MoMo, advance" className={inputClass} />
            </Field>
            <SubmitButton className="w-full">Record payment</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h2 className="font-semibold">Daily rate</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {worker.dailyRate !== null
              ? `Personal rate. The ${worker.category?.name ?? "category"} rate is ignored.`
              : worker.category?.dailyRate
                ? `Using the ${worker.category.name} rate of ${money(Number(worker.category.dailyRate))}.`
                : "No rate set. Attendance earns nothing until a rate is set."}
          </p>
          <ActionForm action={setWorkerRate.bind(null, worker.id)} className="mt-3 space-y-3">
            <Field label={`Personal daily rate (${account.currency})`} hint="Leave empty to use the category rate. Past days keep the rate they were recorded with.">
              <input
                type="number"
                name="dailyRate"
                min={0}
                step="any"
                inputMode="decimal"
                defaultValue={worker.dailyRate !== null ? Number(worker.dailyRate) : ""}
                placeholder={rate !== null ? String(rate) : ""}
                className={inputClass}
              />
            </Field>
            <SubmitButton variant="secondary" className="w-full">
              Save rate
            </SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Pay history</h2>
        <PayLedger ledger={ledger} currency={account.currency} />
      </section>
    </div>
  );
}
