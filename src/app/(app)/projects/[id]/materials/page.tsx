import Link from "next/link";
import { Badge, EmptyState, buttonClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { materialRequestStatus } from "@/lib/labels";
import { buildStock, requestTotal } from "@/lib/materials";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Materials · Pyramid" };

export default async function MaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { id } = await params;
  const showAll = (await searchParams).show === "all";
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  const { project, can } = access;
  const currency = project.account.currency;

  const [requests, used] = await Promise.all([
    ctx.db.materialRequest.findMany({
      where: { projectId: id },
      include: { items: true, requestedBy: true, toAccount: true },
      orderBy: { number: "desc" },
    }),
    ctx.db.dailyReportMaterial.findMany({ where: { report: { projectId: id } } }),
  ]);

  const open = requests.filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED");
  const listed = showAll ? requests : open;
  const stock = buildStock(
    requests.filter((r) => r.status === "RECEIVED").flatMap((r) => r.items),
    used,
  );
  const usedValue = stock.reduce((sum, row) => sum + (row.usedValue ?? 0), 0);
  const remainingValue = stock.reduce((sum, row) => sum + (row.remainingValue ?? 0), 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 text-sm">
            <Link
              href={`/projects/${id}/materials`}
              className={`rounded-lg px-3 py-1.5 font-medium ${showAll ? "text-zinc-600" : "bg-zinc-100 text-zinc-900"}`}
            >
              Open ({open.length})
            </Link>
            <Link
              href={`/projects/${id}/materials?show=all`}
              className={`rounded-lg px-3 py-1.5 font-medium ${showAll ? "bg-zinc-100 text-zinc-900" : "text-zinc-600"}`}
            >
              All ({requests.length})
            </Link>
          </div>
          {can.requestMaterials && (
            <Link href={`/projects/${id}/materials/new`} className={buttonClass.primary}>
              Request materials
            </Link>
          )}
        </div>

        {listed.length === 0 ? (
          <EmptyState title={showAll ? "No material requests yet" : "No open requests"}>
            {can.requestMaterials ? "Request what the site needs and send it to whoever pays." : undefined}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
            {listed.map((request) => {
              const status = materialRequestStatus[request.status];
              const { total, unpriced } = requestTotal(request.items);
              const waitingOnMe = request.status === "SUBMITTED" && access.manages(request.toAccountId);
              return (
                <li key={request.id}>
                  <Link href={`/projects/${id}/materials/${request.id}`} className="block px-4 py-3 hover:bg-zinc-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-zinc-900">
                        #{request.number} ·{" "}
                        <span className="font-normal text-zinc-700">
                          {request.items
                            .slice(0, 3)
                            .map((item) => item.name)
                            .join(", ")}
                          {request.items.length > 3 && ` +${request.items.length - 3} more`}
                        </span>
                      </p>
                      <div className="flex items-center gap-2">
                        {waitingOnMe && <Badge tone="amber">Needs your decision</Badge>}
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </div>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {request.requestedBy.name ?? request.requestedBy.email} → {request.toAccount.name} ·{" "}
                      {formatDate(request.createdAt)}
                      {request.neededBy && ` · needed by ${formatDate(request.neededBy)}`}
                      {can.viewMoney && total > 0 && (
                        <>
                          {" · "}
                          <span className="text-zinc-800">{formatMoney(total, currency)}</span>
                          {unpriced > 0 && ` (+${unpriced} unpriced)`}
                        </>
                      )}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Stock on site</h2>
        <p className="mb-3 text-sm text-zinc-600">
          Delivered through received requests, minus what daily reports recorded as used. Materials are matched by name
          and unit.
        </p>
        {stock.length === 0 ? (
          <EmptyState title="Nothing in stock yet">Received deliveries and materials used in daily reports appear here.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 text-right font-medium">Received</th>
                  <th className="px-3 py-2 text-right font-medium">Used</th>
                  <th className="px-3 py-2 text-right font-medium">Left</th>
                  {can.viewMoney && <th className="px-3 py-2 text-right font-medium">Used value</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stock.map((row) => (
                  <tr key={`${row.name}|${row.unit}`}>
                    <td className="px-3 py-2 text-zinc-900">
                      {row.name} <span className="text-zinc-500">({row.unit})</span>
                    </td>
                    <td className="px-3 py-2 text-right">{formatQuantity(row.received)}</td>
                    <td className="px-3 py-2 text-right">{formatQuantity(row.used)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${row.remaining < 0 ? "text-red-700" : "text-zinc-900"}`}>
                      {formatQuantity(row.remaining)}
                    </td>
                    {can.viewMoney && (
                      <td className="px-3 py-2 text-right">
                        {row.usedValue === null ? <span className="text-zinc-400">no price</span> : formatMoney(row.usedValue, currency)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {can.viewMoney && (
                <tfoot className="border-t border-zinc-200 bg-zinc-50 text-zinc-700">
                  <tr>
                    <td colSpan={4} className="px-3 py-2">
                      Value of materials used · still in stock: {formatMoney(remainingValue, currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-zinc-900">{formatMoney(usedValue, currency)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {stock.some((row) => row.remaining < 0) && (
          <p className="mt-2 text-sm text-red-700">
            Red means reports used more than was delivered through Pyramid: the material came from elsewhere, or the
            names or units don&apos;t match.
          </p>
        )}
      </section>
    </div>
  );
}
