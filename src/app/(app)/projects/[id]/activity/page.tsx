import Link from "next/link";
import { Badge, EmptyState, buttonClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { engagementModels, expenseCategoryLabels, materialRequestStatus } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Activity · Pyramid" };

/** The project's activity feed: its "commit history". */
export default async function ProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, can } = await getProjectAccess(ctx, id);
  const currency = project.account.currency;

  const [reports, expenses, contracts, requests] = await Promise.all([
    ctx.db.dailyReport.findMany({
      where: { projectId: id },
      include: { photos: true, materials: true, wages: true, createdBy: true, account: true },
    }),
    can.viewMoney
      ? ctx.db.expense.findMany({ where: { projectId: id }, include: { createdBy: true } })
      : Promise.resolve([]),
    ctx.db.contract.findMany({ where: { projectId: id }, include: { contractor: true } }),
    ctx.db.materialRequest.findMany({
      where: { projectId: id },
      include: { items: true, requestedBy: true, toAccount: true },
    }),
  ]);
  const dayOf = (date: Date) => new Date(date.toISOString().slice(0, 10));

  // Merge everything into one timeline, newest first.
  const events = [
    ...reports.map((report) => ({ kind: "report" as const, day: report.date, at: report.createdAt, report })),
    ...expenses.map((expense) => ({ kind: "expense" as const, day: expense.date, at: expense.createdAt, expense })),
    ...contracts
      .filter((contract) => contract.status === "ACTIVE" || contract.status === "ENDED")
      .map((contract) => ({
        kind: "hire" as const,
        day: dayOf(contract.createdAt),
        at: contract.createdAt,
        contract,
      })),
    ...requests.map((request) => ({ kind: "request" as const, day: dayOf(request.createdAt), at: request.createdAt, request })),
  ].sort((a, b) => b.day.getTime() - a.day.getTime() || b.at.getTime() - a.at.getTime());

  const days = Map.groupBy(events, (event) => event.day.getTime());

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {reports.length} daily {reports.length === 1 ? "report" : "reports"}
        </p>
        {can.report && (
          <Link href={`/projects/${id}/reports/new`} className={buttonClass.primary}>
            New daily report
          </Link>
        )}
      </div>

      {events.length === 0 && (
        <EmptyState title="No activity yet">The first daily report will start this project&apos;s history.</EmptyState>
      )}

      <ol className="space-y-6">
        {[...days.entries()].map(([day, dayEvents]) => (
          <li key={day}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">{formatDate(new Date(day))}</h2>
            <ol className="space-y-3 border-l-2 border-zinc-200 pl-4">
              {dayEvents.map((event) => {
                if (event.kind === "report") {
                  const { report } = event;
                  const wageTotal = report.wages.reduce((sum, wage) => sum + Number(wage.amount), 0);
                  return (
                    <li key={report.id} className="relative rounded-xl border border-zinc-200 bg-white p-4">
                      <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <Badge tone="amber">Daily report</Badge>
                        <span className="font-medium text-zinc-900">{report.createdBy.name ?? report.createdBy.email}</span>
                        <span className="text-zinc-500">
                          {report.account.name} · {formatDateTime(report.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-zinc-800">{report.description}</p>

                      {report.photos.length > 0 && (
                        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {report.photos.map((photo) => (
                            <li key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-zinc-100">
                              <a href={`/api/files/${photo.key}`} target="_blank" rel="noreferrer">
                                {/* Served by an authenticated route, which next/image cannot fetch. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`/api/files/${photo.key}`}
                                  alt="Photo of the day's work"
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}

                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-zinc-500">People on site</dt>
                          <dd className="font-medium text-zinc-900">{report.workersCount}</dd>
                        </div>
                        {report.materials.length > 0 && (
                          <div>
                            <dt className="text-zinc-500">Materials used</dt>
                            <dd>
                              <ul className="text-zinc-900">
                                {report.materials.map((material) => (
                                  <li key={material.id}>
                                    {material.name}: {formatQuantity(material.quantity)} {material.unit}
                                  </li>
                                ))}
                              </ul>
                            </dd>
                          </div>
                        )}
                        {can.viewMoney && report.wages.length > 0 && (
                          <div>
                            <dt className="text-zinc-500">Wages · {formatMoney(wageTotal, currency)}</dt>
                            <dd>
                              <ul className="text-zinc-900">
                                {report.wages.map((wage) => (
                                  <li key={wage.id}>
                                    {wage.categoryName} × {wage.workers}: {formatMoney(wage.amount, currency)}
                                  </li>
                                ))}
                              </ul>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </li>
                  );
                }

                if (event.kind === "expense") {
                  const { expense } = event;
                  return (
                    <li key={expense.id} className="relative rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                      <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-sky-500" />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone="blue">Expense</Badge>
                        <span className="font-medium text-zinc-900">{formatMoney(expense.amount, currency)}</span>
                        <span className="text-zinc-600">
                          {expenseCategoryLabels[expense.category]}
                          {expense.note && ` — ${expense.note}`}
                        </span>
                        <span className="text-zinc-500">· {expense.createdBy.name ?? expense.createdBy.email}</span>
                      </div>
                    </li>
                  );
                }

                if (event.kind === "request") {
                  const { request } = event;
                  const status = materialRequestStatus[request.status];
                  return (
                    <li key={request.id} className="relative rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                      <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-violet-500" />
                      <Link href={`/projects/${id}/materials/${request.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={status.tone}>Materials #{request.number}</Badge>
                        <span className="text-zinc-900">
                          <strong>{request.requestedBy.name ?? request.requestedBy.email}</strong> requested{" "}
                          {request.items.map((item) => item.name).join(", ")} from {request.toAccount.name}
                        </span>
                        <span className="text-zinc-500">· {status.label}</span>
                      </Link>
                    </li>
                  );
                }

                const { contract } = event;
                return (
                  <li key={contract.id} className="relative rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                    <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone="green">Hire</Badge>
                      <span className="text-zinc-900">
                        <strong>{contract.contractor.name}</strong> was hired · {engagementModels[contract.engagementModel].label}
                        {contract.status === "ENDED" && " (ended)"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </>
  );
}
