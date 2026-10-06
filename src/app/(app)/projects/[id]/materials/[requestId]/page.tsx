import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveMaterialRequest,
  cancelMaterialRequest,
  forwardMaterialRequest,
  receiveMaterialRequest,
  rejectMaterialRequest,
} from "@/actions/materials";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, buttonClass, inputClass } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { formatDate, formatDateTime, formatMoney, formatQuantity } from "@/lib/format";
import { materialRequestStatus } from "@/lib/labels";
import { canForward, itemTotal, requestTotal } from "@/lib/materials";
import { requireContext } from "@/lib/session";

const compactInput = inputClass.replace("px-3", "px-2");

export const metadata = { title: "Material request · Pyramid" };

export default async function MaterialRequestPage({ params }: { params: Promise<{ id: string; requestId: string }> }) {
  const { id, requestId } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  const { project, can } = access;
  const currency = project.account.currency;

  const request = await ctx.db.materialRequest.findFirst({
    where: { id: requestId, projectId: id },
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      requestedBy: true,
      decidedBy: true,
      receivedBy: true,
      fromAccount: true,
      toAccount: true,
      expense: true,
    },
  });
  if (!request) notFound();

  const status = materialRequestStatus[request.status];
  const decides = request.status === "SUBMITTED" && access.manages(request.toAccountId);
  const pays = access.manages(request.toAccountId);
  const receives = request.status === "APPROVED" && (can.receiveMaterials || pays);
  const received = request.status === "RECEIVED";
  const { total, unpriced } = requestTotal(request.items);
  const person = (user: { name: string | null; email: string } | null) => user?.name ?? user?.email ?? "Someone";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={`/projects/${id}/materials`} className="text-sm text-zinc-600 hover:text-zinc-900">
        ← Materials
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Material request #{request.number}</h2>
            <p className="mt-0.5 text-sm text-zinc-600">
              From {person(request.requestedBy)} ({request.fromAccount.name}) to <strong>{request.toAccount.name}</strong>
            </p>
            <p className="text-sm text-zinc-500">
              Sent {formatDateTime(request.createdAt)}
              {request.neededBy && ` · needed by ${formatDate(request.neededBy)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <a href={`/print/material-requests/${request.id}`} target="_blank" className={buttonClass.secondary}>
              Print / PDF
            </a>
          </div>
        </div>
        {request.note && <p className="mt-3 whitespace-pre-line rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800">{request.note}</p>}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="border-b border-zinc-200 text-left text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">Requested</th>
                {received && <th className="px-3 py-2 text-right font-medium">Received</th>}
                {can.viewMoney && <th className="px-3 py-2 text-right font-medium">Unit price</th>}
                {can.viewMoney && <th className="py-2 pl-3 text-right font-medium">Total</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {request.items.map((item) => {
                const line = itemTotal(item);
                const short = received && Number(item.receivedQuantity) !== Number(item.quantity);
                return (
                  <tr key={item.id} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-zinc-900">{item.name}</p>
                      {item.details && <p className="whitespace-pre-line text-zinc-600">{item.details}</p>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {formatQuantity(item.quantity)} {item.unit}
                    </td>
                    {received && (
                      <td className={`whitespace-nowrap px-3 py-2 text-right ${short ? "font-semibold text-red-700" : ""}`}>
                        {formatQuantity(item.receivedQuantity ?? 0)} {item.unit}
                      </td>
                    )}
                    {can.viewMoney && (
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {item.unitPrice === null ? <span className="text-zinc-400">—</span> : formatMoney(item.unitPrice, currency)}
                      </td>
                    )}
                    {can.viewMoney && (
                      <td className="whitespace-nowrap py-2 pl-3 text-right">{line === null ? "—" : formatMoney(line, currency)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {can.viewMoney && (
              <tfoot className="border-t border-zinc-200">
                <tr>
                  <td colSpan={received ? 4 : 3} className="py-2 pr-3 text-zinc-600">
                    {received ? "Cost of what was received" : "Estimated total"}
                    {unpriced > 0 && ` · ${unpriced} item${unpriced === 1 ? "" : "s"} without a price`}
                  </td>
                  <td className="py-2 pl-3 text-right font-semibold text-zinc-900">{formatMoney(total, currency)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {received && request.items.some((item) => Number(item.receivedQuantity) !== Number(item.quantity)) && (
          <p className="mt-2 text-sm text-red-700">Quantities in red differ from what was requested.</p>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">History</h3>
        <ol className="space-y-2 text-sm text-zinc-700">
          <li>
            {formatDateTime(request.createdAt)} — {person(request.requestedBy)} sent the request
          </li>
          {request.forwardedAt && (
            <li>
              {formatDateTime(request.forwardedAt)} — forwarded to {request.toAccount.name}
            </li>
          )}
          {request.decidedAt && (
            <li>
              {formatDateTime(request.decidedAt)} — {person(request.decidedBy)}{" "}
              {request.status === "REJECTED" ? "rejected it" : "approved it"}
              {request.decisionNote && <>: “{request.decisionNote}”</>}
            </li>
          )}
          {request.status === "CANCELLED" && (
            <li>
              {formatDateTime(request.updatedAt)} — {person(request.requestedBy)} cancelled it
            </li>
          )}
          {request.receivedAt && (
            <li>
              {formatDateTime(request.receivedAt)} — {person(request.receivedBy)} confirmed the delivery
              {request.receivedNote && <>: “{request.receivedNote}”</>}
            </li>
          )}
          {can.viewMoney && request.expense && (
            <li>
              Logged as a materials expense of {formatMoney(request.expense.amount, currency)} for {request.toAccount.name}.{" "}
              <Link href={`/projects/${id}/expenses`} className="underline">
                View expenses
              </Link>
            </li>
          )}
        </ol>
      </Card>

      {decides && (
        <Card>
          <h3 className="font-semibold">Approve this request</h3>
          <p className="mb-3 text-sm text-zinc-600">Confirm or enter prices now, or leave them empty and add them on delivery.</p>
          <ActionForm action={approveMaterialRequest.bind(null, id, request.id)} className="space-y-3">
            <PriceInputs items={request.items} currency={currency} />
            <Field label="Note to the requester (optional)">
              <input name="decisionNote" placeholder="e.g. Delivery on Thursday" className={inputClass} />
            </Field>
            <SubmitButton>Approve</SubmitButton>
          </ActionForm>

          <hr className="my-4 border-zinc-200" />
          <ActionForm action={rejectMaterialRequest.bind(null, id, request.id)} className="flex flex-wrap items-end gap-2">
            <Field label="Reason for rejecting (optional)" className="min-w-0 flex-1">
              <input name="decisionNote" className={inputClass} />
            </Field>
            <SubmitButton variant="danger">Reject</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {canForward(access, request) && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-700">Should the project owner pay for this instead?</p>
          <form action={forwardMaterialRequest.bind(null, id, request.id)}>
            <SubmitButton variant="secondary">Forward to {project.account.name}</SubmitButton>
          </form>
        </Card>
      )}

      {request.status === "SUBMITTED" && request.requestedById === ctx.user.id && (
        <form action={cancelMaterialRequest.bind(null, id, request.id)}>
          <SubmitButton variant="danger">Cancel request</SubmitButton>
        </form>
      )}

      {receives && (
        <Card>
          <h3 className="font-semibold">Confirm delivery</h3>
          <p className="mb-3 text-sm text-zinc-600">
            Count what arrived. Anything different from the request is recorded as a discrepancy.
            {pays && " The cost is logged as a materials expense."}
          </p>
          <ActionForm action={receiveMaterialRequest.bind(null, id, request.id)} className="space-y-3">
            <div className="space-y-2">
              <div className={`grid gap-2 text-xs font-medium text-zinc-500 ${pays ? "grid-cols-[1fr_6rem_7rem]" : "grid-cols-[1fr_6rem]"}`}>
                <span>Material</span>
                <span>Received</span>
                {pays && <span>Unit price ({currency})</span>}
              </div>
              {request.items.map((item) => (
                <div
                  key={item.id}
                  className={`grid items-center gap-2 ${pays ? "grid-cols-[1fr_6rem_7rem]" : "grid-cols-[1fr_6rem]"}`}
                >
                  <span className="truncate text-sm text-zinc-800">
                    {item.name} · {formatQuantity(item.quantity)} {item.unit}
                  </span>
                  <input
                    aria-label={`Received: ${item.name}`}
                    type="number"
                    name={`received-${item.id}`}
                    required
                    min={0}
                    step="any"
                    inputMode="decimal"
                    defaultValue={Number(item.quantity)}
                    className={compactInput}
                  />
                  {pays && (
                    <input
                      aria-label={`Unit price: ${item.name}`}
                      type="number"
                      name={`price-${item.id}`}
                      min={0}
                      step="any"
                      inputMode="decimal"
                      defaultValue={item.unitPrice === null ? "" : Number(item.unitPrice)}
                      className={compactInput}
                    />
                  )}
                </div>
              ))}
            </div>
            <Field label="Delivery note (optional)">
              <input name="receivedNote" placeholder="e.g. 2 bags torn, supplier will replace" className={inputClass} />
            </Field>
            <SubmitButton>Confirm delivery</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}

function PriceInputs({
  items,
  currency,
}: {
  items: { id: string; name: string; quantity: { toString(): string }; unit: string; unitPrice: { toString(): string } | null }[];
  currency: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_8rem] gap-2 text-xs font-medium text-zinc-500">
        <span>Material</span>
        <span>Unit price ({currency})</span>
      </div>
      {items.map((item) => (
        <div key={item.id} className="grid grid-cols-[1fr_8rem] items-center gap-2">
          <span className="truncate text-sm text-zinc-800">
            {item.name} · {formatQuantity(item.quantity)} {item.unit}
          </span>
          <input
            aria-label={`Unit price: ${item.name}`}
            type="number"
            name={`price-${item.id}`}
            min={0}
            step="any"
            inputMode="decimal"
            defaultValue={item.unitPrice === null ? "" : Number(item.unitPrice)}
            className={compactInput}
          />
        </div>
      ))}
    </div>
  );
}
