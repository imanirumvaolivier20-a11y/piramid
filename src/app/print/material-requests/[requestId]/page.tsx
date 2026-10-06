import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getProjectAccess } from "@/lib/access";
import { accountImage } from "@/lib/avatar";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { materialRequestStatus } from "@/lib/labels";
import { itemTotal, requestTotal } from "@/lib/materials";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Material request · Pyramid" };

/**
 * A plain, printable version of a material request. "Save as PDF" in the
 * browser's print dialog turns it into a PDF to send to a supplier.
 */
export default async function PrintMaterialRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const ctx = await requireContext();

  const request = await ctx.db.materialRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      requestedBy: true,
      decidedBy: true,
      fromAccount: { include: { owner: { select: { image: true } } } },
      toAccount: true,
      project: true,
    },
  });
  if (!request) notFound();
  const { can, project } = await getProjectAccess(ctx, request.projectId);
  const currency = project.account.currency;
  // The printout is an order, so it is priced on requested quantities.
  const ordered = request.items.map((item) => ({ ...item, receivedQuantity: null }));
  const { total } = requestTotal(ordered);
  const logo = accountImage(request.fromAccount);

  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-6 text-sm text-zinc-900 print:max-w-none print:p-0">
      <div className="mb-6 flex justify-end gap-2 print:hidden">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between gap-4 border-b border-zinc-300 pb-4">
        <div className="flex items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" />
          )}
          <div>
            <p className="text-lg font-semibold">{request.fromAccount.name}</p>
            {[request.fromAccount.phone, request.fromAccount.email].filter(Boolean).length > 0 && (
              <p className="text-zinc-600">{[request.fromAccount.phone, request.fromAccount.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">Material request #{request.number}</p>
          <p className="text-zinc-600">{formatDate(request.createdAt)}</p>
          <p className="text-zinc-600">{materialRequestStatus[request.status].label}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-zinc-500">Project</dt>
          <dd className="font-medium">
            {request.project.name}
            {request.project.location && `, ${request.project.location}`}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Sent to</dt>
          <dd className="font-medium">{request.toAccount.name}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Requested by</dt>
          <dd className="font-medium">{request.requestedBy.name ?? request.requestedBy.email}</dd>
        </div>
        {request.neededBy && (
          <div>
            <dt className="text-zinc-500">Needed by</dt>
            <dd className="font-medium">{formatDate(request.neededBy)}</dd>
          </div>
        )}
      </dl>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-zinc-800 text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Material / description</th>
            <th className="px-2 py-2 text-right">Quantity</th>
            {can.viewMoney && <th className="px-2 py-2 text-right">Unit price</th>}
            {can.viewMoney && <th className="py-2 pl-2 text-right">Total</th>}
          </tr>
        </thead>
        <tbody>
          {ordered.map((item, index) => {
            const line = itemTotal(item);
            return (
              <tr key={item.id} className="border-b border-zinc-200 align-top">
                <td className="py-2 pr-2">{index + 1}</td>
                <td className="py-2 pr-2">
                  <p className="font-medium">{item.name}</p>
                  {item.details && <p className="whitespace-pre-line text-zinc-600">{item.details}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  {formatQuantity(item.quantity)} {item.unit}
                </td>
                {can.viewMoney && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {item.unitPrice === null ? "" : formatMoney(item.unitPrice, currency)}
                  </td>
                )}
                {can.viewMoney && (
                  <td className="whitespace-nowrap py-2 pl-2 text-right">{line === null ? "" : formatMoney(line, currency)}</td>
                )}
              </tr>
            );
          })}
        </tbody>
        {can.viewMoney && total > 0 && (
          <tfoot>
            <tr>
              <td colSpan={4} className="py-2 pr-2 text-right font-semibold">
                Total
              </td>
              <td className="whitespace-nowrap py-2 pl-2 text-right font-semibold">
                {formatMoney(total, currency)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {request.note && (
        <section className="mt-6">
          <h2 className="font-semibold">Note</h2>
          <p className="whitespace-pre-line text-zinc-700">{request.note}</p>
        </section>
      )}

      {request.decidedAt && request.status !== "REJECTED" && (
        <p className="mt-6 text-zinc-700">
          Approved by {request.decidedBy?.name ?? request.decidedBy?.email} on {formatDate(request.decidedAt)}.
        </p>
      )}

      <footer className="mt-12 grid grid-cols-2 gap-8 text-zinc-600">
        <div className="border-t border-zinc-400 pt-1">Requested by (signature)</div>
        <div className="border-t border-zinc-400 pt-1">Approved by (signature)</div>
      </footer>
      <p className="mt-8 text-xs text-zinc-400">Generated with Pyramid</p>
    </main>
  );
}
