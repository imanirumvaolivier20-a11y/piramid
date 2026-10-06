import type { ReactNode } from "react";
import Link from "next/link";
import { endContract, respondToHire } from "@/actions/contracts";
import { SubmitButton } from "@/components/forms";
import { Tabs } from "@/components/nav-links";
import { Avatar, Badge } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
import { getProjectAccess } from "@/lib/access";
import { formatMoney } from "@/lib/format";
import { engagementModels, projectStatusLabels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const { project, contract, level, can } = await getProjectAccess(ctx, id);
  const base = `/projects/${id}`;

  const tabs = [
    { href: base, label: "Activity", exact: true },
    { href: `${base}/materials`, label: "Materials" },
    ...(can.viewMoney
      ? [
          { href: `${base}/expenses`, label: "Expenses" },
          { href: `${base}/summary`, label: "Summary" },
        ]
      : []),
    { href: `${base}/team`, label: "Team" },
  ];

  return (
    <>
      <div className="mb-4">
        <Link href="/dashboard" className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Projects
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <Badge tone={project.status === "ACTIVE" ? "green" : "neutral"}>{projectStatusLabels[project.status]}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {[project.location, `Owner: ${project.account.name}`].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Who is hired on this project, and the actions each side can take. */}
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        {contract ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Avatar src={accountImage(contract.contractor)} name={contract.contractor.name} />
              <div className="min-w-0">
              <p className="text-zinc-900">
                {contract.status === "PENDING" ? "Hire request sent to " : "Managed by "}
                <Link href={`/accounts/${contract.contractor.username}`} className="font-semibold underline">
                  {contract.contractor.name}
                </Link>
                {contract.status === "PENDING" && <span className="text-zinc-600"> — awaiting response</span>}
              </p>
              <p className="mt-0.5 text-zinc-600">
                {engagementModels[contract.engagementModel].label}
                {can.viewMoney &&
                  contract.agreedBudget &&
                  ` · Agreed budget ${formatMoney(contract.agreedBudget, project.account.currency)}`}
              </p>
              {contract.note && <p className="mt-1 text-zinc-600">“{contract.note}”</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {can.respond && (
                <>
                  <form action={respondToHire.bind(null, id, true)}>
                    <SubmitButton>Accept</SubmitButton>
                  </form>
                  <form action={respondToHire.bind(null, id, false)}>
                    <SubmitButton variant="secondary">Decline</SubmitButton>
                  </form>
                </>
              )}
              {can.endContract && (
                <form action={endContract.bind(null, id)}>
                  <SubmitButton variant="danger">{contract.status === "PENDING" ? "Cancel request" : "End hire"}</SubmitButton>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-zinc-600">
              {level === "OWNER" ? "No company or engineer is hired on this project." : "This project is managed by its owner."}
            </p>
            {can.hire && (
              <Link href={`${base}/hire`} className="font-semibold text-amber-700 underline">
                Hire Engineer or Company
              </Link>
            )}
          </div>
        )}
      </div>

      <Tabs links={tabs} />
      <div className="pt-5">{children}</div>
    </>
  );
}
