import Link from "next/link";
import { saveAttendance } from "@/actions/attendance";
import { AttendanceForm } from "@/components/attendance-form";
import { EmptyState, buttonClass, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatMoney, fromDateInput, toDateInput } from "@/lib/format";
import { projectRoleLabels } from "@/lib/labels";
import { addDays, dailyRateOf, periodFor } from "@/lib/payroll";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Attendance · Pyramid" };

const mark = { PRESENT: "✓", HALF_DAY: "½", ABSENT: "✗" } as const;

export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  const { project, can } = access;
  const currency = project.account.currency;
  const base = `/projects/${id}/attendance`;

  const today = toDateInput(new Date());
  const wanted = (await searchParams).date;
  const dateText = wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && wanted <= today ? wanted : today;
  const date = fromDateInput(dateText);
  const week = periodFor(date, "WEEKLY");
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));

  const [members, weekAttendance, dayElsewhere] = await Promise.all([
    ctx.db.projectMember.findMany({
      where: { projectId: id, worker: { active: true } },
      include: { worker: { include: { category: true } }, account: true },
      orderBy: { worker: { name: "asc" } },
    }),
    ctx.db.attendance.findMany({
      where: { projectId: id, date: { gte: week.start, lte: week.end } },
      include: { worker: true },
    }),
    // The same workers recorded on another project that day.
    ctx.db.attendance.findMany({
      where: { date, projectId: { not: id } },
      include: { project: true },
    }),
  ]);

  const mine = can.attendance ? members.filter((m) => m.accountId === access.actingAccountId) : [];
  const dayRecords = weekAttendance.filter((a) => a.date.getTime() === date.getTime());

  const rows = mine.map(({ worker, role }) => {
    const record = dayRecords.find((a) => a.workerId === worker.id);
    const other = dayElsewhere.find((a) => a.workerId === worker.id);
    return {
      workerId: worker.id,
      name: worker.name,
      // The category is only worth showing when it says more than the role.
      detail: [
        projectRoleLabels[role],
        worker.category && !worker.category.name.toLowerCase().startsWith(projectRoleLabels[role].toLowerCase())
          ? worker.category.name
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      status: record?.status ?? null,
      rate: record ? Number(record.rate) : dailyRateOf(worker),
      lockedBy: other?.project.name ?? null,
    };
  });

  // Everyone on the project for the week overview, including other accounts' workers.
  const weekWorkers = [
    ...new Map(
      [...members.map((m) => [m.workerId, m.worker.name] as const), ...weekAttendance.map((a) => [a.workerId, a.worker.name] as const)],
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const weekTotal = weekAttendance.reduce((sum, a) => sum + Number(a.amount), 0);

  const dayLink = (offset: number) => toDateInput(addDays(date, offset));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`${base}?date=${dayLink(-1)}`} className={buttonClass.secondary} aria-label="Previous day">
          ←
        </Link>
        <form className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={dateText} max={today} aria-label="Date" className={`${inputClass} w-auto`} />
          <button type="submit" className={buttonClass.secondary}>
            Go
          </button>
        </form>
        {dateText < today && (
          <Link href={`${base}?date=${dayLink(1)}`} className={buttonClass.secondary} aria-label="Next day">
            →
          </Link>
        )}
        <h2 className="ml-1 font-semibold">{dateText === today ? `Today, ${formatDate(date)}` : formatDate(date)}</h2>
      </div>

      {can.attendance &&
        (rows.length === 0 ? (
          <EmptyState title="None of your workers are on this project">
            Assign workers from the{" "}
            <Link href={`/projects/${id}/team`} className="underline">
              Team
            </Link>{" "}
            tab, then mark their attendance here.
          </EmptyState>
        ) : (
          <AttendanceForm
            key={dateText}
            action={saveAttendance.bind(null, id)}
            date={dateText}
            rows={rows}
            showMoney={can.viewMoney}
            currency={currency}
          />
        ))}

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Week of {formatDate(week.start)}</h2>
          {can.viewMoney && (
            <p className="text-sm text-zinc-600">
              Wages this week <strong className="text-zinc-900">{formatMoney(weekTotal, currency)}</strong>
            </p>
          )}
        </div>
        {weekWorkers.length === 0 ? (
          <EmptyState title="No workers on this project yet" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Worker</th>
                  {weekDays.map((day) => (
                    <th key={day.getTime()} className="px-1 py-2 text-center font-medium">
                      <Link href={`${base}?date=${toDateInput(day)}`} className={day.getTime() === date.getTime() ? "text-amber-700 underline" : ""}>
                        {new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(day)}{" "}
                        {day.getUTCDate()}
                      </Link>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {weekWorkers.map(([workerId, name]) => {
                  const records = weekAttendance.filter((a) => a.workerId === workerId);
                  const days = records.reduce((sum, a) => sum + (a.status === "PRESENT" ? 1 : a.status === "HALF_DAY" ? 0.5 : 0), 0);
                  return (
                    <tr key={workerId}>
                      <td className="px-3 py-2 text-zinc-900">{name}</td>
                      {weekDays.map((day) => {
                        const record = records.find((a) => a.date.getTime() === day.getTime());
                        return (
                          <td
                            key={day.getTime()}
                            className={`px-1 py-2 text-center font-semibold ${
                              record?.status === "PRESENT"
                                ? "text-emerald-700"
                                : record?.status === "HALF_DAY"
                                  ? "text-amber-600"
                                  : "text-zinc-400"
                            }`}
                          >
                            {record ? mark[record.status] : "·"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-medium">{days}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">✓ present · ½ half day · ✗ absent · tap a day to open it.</p>
      </section>
    </div>
  );
}
