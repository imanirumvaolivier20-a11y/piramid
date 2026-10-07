import { EmptyState } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { type buildLedger, attendanceLabels, periodLabel } from "@/lib/payroll";

/** A worker's pay history by pay period: days worked, earned, paid, balance. */
export function PayLedger({ ledger, currency }: { ledger: ReturnType<typeof buildLedger>; currency: string }) {
  const money = (amount: number) => formatMoney(amount, currency);
  if (ledger.periods.length === 0) return <EmptyState title="No attendance or payments yet" />;

  return (
    <ol className="space-y-3">
      {ledger.periods.map((entry) => (
        <li key={entry.period.start.getTime()}>
          <details className="group rounded-xl border border-zinc-200 bg-white" open={entry === ledger.periods[0]}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span>
                <span className="font-medium text-zinc-900">{periodLabel(entry.period)}</span>
                <span className="block text-sm text-zinc-500">
                  {entry.days} {entry.days === 1 ? "day" : "days"} · earned {money(entry.earned)}
                  {entry.paid > 0 && ` · paid ${money(entry.paid)}`}
                </span>
              </span>
              <span className={`text-sm ${entry.balance > 0 ? "font-semibold text-zinc-900" : "text-zinc-500"}`}>
                {entry.balance > 0 ? `Owed ${money(entry.balance)}` : entry.balance < 0 ? `Ahead ${money(-entry.balance)}` : "Settled"}
                <span className="ml-2 inline-block text-zinc-400 transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100 text-sm">
              {entry.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3 bg-emerald-50/50 px-4 py-2">
                  <span className="text-zinc-800">
                    {formatDate(payment.date)} · <strong>Payment</strong>
                    {payment.note && <span className="text-zinc-500"> — {payment.note}</span>}
                  </span>
                  <span className="shrink-0 font-medium text-emerald-800">−{money(Number(payment.amount))}</span>
                </li>
              ))}
              {entry.attendance.map((day) => (
                <li key={day.id} className="flex justify-between gap-3 px-4 py-2">
                  <span className="text-zinc-700">
                    {formatDate(day.date)} · {attendanceLabels[day.status]}
                    <span className="text-zinc-500"> · {day.project.name}</span>
                  </span>
                  <span className="shrink-0 text-zinc-900">{money(Number(day.amount))}</span>
                </li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ol>
  );
}
