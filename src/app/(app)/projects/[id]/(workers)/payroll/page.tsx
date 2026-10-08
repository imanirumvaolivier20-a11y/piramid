import { CalendarRange, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { recordPayment, setPayCycle } from "@/actions/payroll";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MenuAction, MenuDivider, MenuLabel, MenuLink, MoreMenu } from "@/components/menu";
import { Avatar, EmptyState, inputClass } from "@/components/ui";
import type { PayCycle } from "@/generated/prisma/enums";
import { getProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { formatMoney, fromDateInput, toDateInput } from "@/lib/format";
import { attendanceShare, nextPeriod, payCycleLabels, periodFor, periodKey, periodLabel, previousPeriod } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Payroll · Pyramid" };

/** This project's payroll: what each of the account's workers earned here, was paid here, and is owed. */
export default async function ProjectPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  if (!access.can.payroll) redirect(`/projects/${id}/team`);
  const employer = await prisma.account.findUniqueOrThrow({ where: { id: access.actingAccountId } });
  const money = (amount: number) => formatMoney(amount, employer.currency);
  const base = `/projects/${id}/payroll`;

  const cycle: PayCycle = employer.payCycle;
  const current = periodFor(new Date(), cycle);
  const wanted = (await searchParams).period;
  const period = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) ? periodFor(fromDateInput(wanted), cycle) : current;
  const isCurrent = period.start.getTime() === current.start.getTime();

  const scope = { projectId: id, accountId: employer.id };
  const [members, attendance, payments] = await Promise.all([
    ctx.db.projectMember.findMany({ where: { projectId: id, accountId: employer.id }, select: { workerId: true } }),
    ctx.db.attendance.findMany({ where: scope, include: { worker: true } }),
    ctx.db.workerPayment.findMany({ where: scope, include: { worker: true } }),
  ]);

  // Everyone on the team, plus anyone who has pay history here after leaving it.
  const workers = new Map<string, { id: string; name: string }>();
  attendance.forEach((a) => workers.set(a.workerId, a.worker));
  payments.forEach((p) => workers.set(p.workerId, p.worker));
  const onTeam = new Set(members.map((m) => m.workerId));
  if (onTeam.size > 0) {
    const team = await ctx.db.worker.findMany({ where: { id: { in: [...onTeam] } } });
    team.forEach((w) => workers.set(w.id, w));
  }

  const within = (date: Date) => date >= period.start && date <= period.end;
  const rows = [...workers.values()]
    .map((worker) => {
      const mine = attendance.filter((a) => a.workerId === worker.id);
      const paidAll = payments.filter((p) => p.workerId === worker.id);
      const inPeriod = mine.filter((a) => within(a.date));
      return {
        worker,
        days: inPeriod.reduce((sum, a) => sum + attendanceShare[a.status], 0),
        earned: inPeriod.reduce((sum, a) => sum + Number(a.amount), 0),
        paid: paidAll.filter((p) => within(p.date)).reduce((sum, p) => sum + Number(p.amount), 0),
        owed:
          mine.reduce((sum, a) => sum + Number(a.amount), 0) - paidAll.reduce((sum, p) => sum + Number(p.amount), 0),
        left: !onTeam.has(worker.id),
        started: mine.length + paidAll.length > 0,
      };
    })
    .filter((row) => !row.left || Math.abs(row.owed) > 0.005)
    .sort((a, b) => b.owed - a.owed || a.worker.name.localeCompare(b.worker.name));

  const owedTotal = rows.reduce((sum, row) => sum + Math.max(row.owed, 0), 0);
  const earnedTotal = rows.reduce((sum, row) => sum + row.earned, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <Link href={`${base}?period=${periodKey(previousPeriod(period, cycle))}`} aria-label="Previous period" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-semibold">{periodLabel(period)}</p>
          <p className="text-xs text-zinc-500">{isCurrent ? "This pay period" : "Past pay period"}</p>
        </div>
        {isCurrent ? (
          <span className="h-10 w-10" />
        ) : (
          <Link href={`${base}?period=${periodKey(nextPeriod(period, cycle))}`} aria-label="Next period" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-zinc-100">
            <ChevronRight className="h-5 w-5" />
          </Link>
        )}
        <MoreMenu label="Payroll options">
          <MenuLabel>Pay cycle for {employer.name}</MenuLabel>
          {(Object.keys(payCycleLabels) as PayCycle[]).map((value) => (
            <MenuAction
              key={value}
              action={setPayCycle.bind(null, id, value)}
              checked={value === cycle}
              icon={<CalendarRange className="h-4 w-4" />}
            >
              {payCycleLabels[value]}
            </MenuAction>
          ))}
          <MenuDivider />
          <MenuLink href="/workers" icon={<SlidersHorizontal className="h-4 w-4" />}>
            Daily rates and categories
          </MenuLink>
        </MoreMenu>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-50 p-4">
          <p className="text-sm text-zinc-500">Earned in this period</p>
          <p className="mt-1 text-xl font-semibold">{money(earnedTotal)}</p>
        </div>
        <div className={`rounded-2xl p-4 ${owedTotal > 0 ? "bg-amber-50" : "bg-zinc-50"}`}>
          <p className="text-sm text-zinc-500">Owed to workers now</p>
          <p className="mt-1 text-xl font-semibold">{money(owedTotal)}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nobody to pay yet">Add workers in Team and mark their attendance.</EmptyState>
      ) : (
        <ul>
          {rows.map(({ worker, days, earned, paid, owed, left, started }) => (
            <li key={worker.id} className="border-b border-zinc-100 py-3 last:border-0">
              <div className="flex items-center gap-3">
                <Avatar src={null} name={worker.name} />
                <Link href={`${base}/${worker.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">
                    {worker.name}
                    {left && <span className="font-normal text-zinc-500"> · left the project</span>}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {days} {days === 1 ? "day" : "days"} · {money(earned)}
                    {paid > 0 && ` · paid ${money(paid)}`}
                  </p>
                </Link>
                <p className={`shrink-0 text-right text-sm ${owed > 0 ? "font-semibold text-zinc-900" : "text-zinc-400"}`}>
                  {owed > 0 ? money(owed) : owed < 0 ? `+${money(-owed)}` : started ? "Paid" : "Nothing yet"}
                </p>
              </div>
              {owed > 0 && (
                <ActionForm key={`${worker.id}-${owed}`} action={recordPayment.bind(null, id, worker.id)} className="mt-2 flex items-center gap-2 pl-13">
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
                    className={`${inputClass} min-w-0 flex-1 py-2 sm:max-w-40`}
                  />
                  <SubmitButton>Pay</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
