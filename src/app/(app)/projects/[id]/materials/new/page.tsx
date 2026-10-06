import { redirect } from "next/navigation";
import { createMaterialRequest } from "@/actions/materials";
import { MaterialRequestForm } from "@/components/material-request-form";
import { Card } from "@/components/ui";
import { getProjectAccess } from "@/lib/access";
import { toDateInput } from "@/lib/format";
import { materialKey } from "@/lib/materials";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Request materials · Pyramid" };

export default async function NewMaterialRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const access = await getProjectAccess(ctx, id);
  if (!access.can.requestMaterials) redirect(`/projects/${id}/materials`);

  const [requested, used] = await Promise.all([
    ctx.db.materialRequestItem.findMany({
      where: { request: { projectId: id } },
      select: { name: true, unit: true },
      distinct: ["name", "unit"],
    }),
    ctx.db.dailyReportMaterial.findMany({
      where: { report: { projectId: id } },
      select: { name: true, unit: true },
      distinct: ["name", "unit"],
    }),
  ]);
  const known = [...new Map([...requested, ...used].map((m) => [materialKey(m.name, m.unit), m])).values()];

  // Suggest the account that usually pays: the owner when they fund materials,
  // otherwise the requester's own company.
  const ownerPays = access.contract?.engagementModel === "OWNER_FUNDS" && access.level === "CONTRACTOR";
  const own = access.recipients.find((r) => r.accountId === access.actingAccountId);
  const defaultRecipient = (ownerPays ? access.project.accountId : own?.accountId) ?? access.recipients[0].accountId;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold">Request materials</h2>
      <p className="mb-3 text-sm text-zinc-600">
        The account you send it to approves it and buys the materials. Once they arrive, confirm what was delivered.
      </p>
      <Card>
        <MaterialRequestForm
          action={createMaterialRequest.bind(null, id)}
          recipients={access.recipients}
          defaultRecipient={defaultRecipient}
          showPrices={access.can.viewMoney}
          currency={access.project.account.currency}
          knownMaterials={known}
          today={toDateInput(new Date())}
        />
      </Card>
    </div>
  );
}
