import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { recordPayment, setWorkerRate } from "@/actions/payroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PayLedger } from "@/components/pay-ledger";
import { Avatar, Field, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatMoney, toDateInput } from "@/lib/format";
import { buildLedger, dailyRateOf } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Pay record · Pyramid" };

/** One worker's pay on this project: balance, payments, days worked, and their rate. */
export default async function WorkerPayPage({ params }: { params: Promise<{ id: string; workerId: string }> }) {
  const { id, workerId } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  if (!access.can.payroll) redirect(`/projects/${id}/team`);
  const employer = await prisma.account.findUniqueOrThrow({ where: { id: access.actingAccountId } });
  const money = (amount: number) => formatMoney(amount, employer.currency);

  const worker = await ctx.db.worker.findFirst({
    where: { id: workerId, accountId: employer.id },
    include: {
      category: true,
      attendance: { where: { projectId: id }, include: { project: true } },
      payments: { where: { projectId: id } },
    },
  });
  if (!worker) notFound();

  const ledger = buildLedger(worker.attendance, worker.payments, employer.payCycle);
  const rate = dailyRateOf(worker);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}/payroll`} aria-label="Back to payroll" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Avatar src={null} name={worker.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{worker.name}</p>
          <p className="truncate text-sm text-zinc-500">
            {[worker.category?.name, rate !== null && `${money(rate)} per day`].filter(Boolean).join(" · ") || "No daily rate yet"}
          </p>
        </div>
      </div>

      <div className={`rounded-2xl p-5 text-center ${ledger.owed > 0 ? "bg-amber-50" : "bg-zinc-50"}`}>
        <p className="text-sm text-zinc-500">{ledger.owed >= 0 ? "Owed on this project" : "Paid in advance"}</p>
        <p className="mt-1 text-3xl font-semibold">{money(Math.abs(ledger.owed))}</p>
      </div>

      <ActionForm key={worker.payments.length} action={recordPayment.bind(null, id, worker.id)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Amount (${employer.currency})`}>
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
        </div>
        <Field label="Note (optional)">
          <input name="note" placeholder="Cash, MoMo, advance…" className={inputClass} />
        </Field>
        <SubmitButton className="w-full">Record payment</SubmitButton>
      </ActionForm>

      <section>
        <h2 className="mb-3 font-semibold">History</h2>
        <PayLedger ledger={ledger} currency={employer.currency} />
      </section>

      <details className="rounded-2xl bg-zinc-50 p-4">
        <summary className="cursor-pointer font-medium">Change daily rate</summary>
        <ActionForm action={setWorkerRate.bind(null, id, worker.id)} className="mt-3 space-y-3">
          <Field
            label={`Personal daily rate (${employer.currency})`}
            hint={
              worker.category?.dailyRate
                ? `Leave empty to use the ${worker.category.name} rate (${money(Number(worker.category.dailyRate))}). Past days keep their rate.`
                : "Past days keep the rate they were recorded with."
            }
          >
            <input
              type="number"
              name="dailyRate"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={worker.dailyRate !== null ? Number(worker.dailyRate) : ""}
              className={inputClass}
            />
          </Field>
          <SubmitButton variant="secondary" className="w-full">
            Save rate
          </SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
