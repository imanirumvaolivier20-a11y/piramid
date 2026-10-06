import Link from "next/link";
import { notFound } from "next/navigation";
import { hireContractor } from "@/actions/contracts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Badge, Card, Field, inputClass } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
import { getProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { engagementModels } from "@/lib/labels";
import { requireContext } from "@/lib/session";

/** Public profile of an account. With ?project=…, the project's owner can hire from here. */
export default async function AccountProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { username } = await params;
  const projectId = (await searchParams).project;
  const ctx = await requireContext();

  const account = await prisma.account.findUnique({
    where: { username },
    include: { type: true, owner: { select: { image: true } }, _count: { select: { contractsAsContractor: { where: { status: { in: ["ACTIVE", "ENDED"] } } } } } },
  });
  if (!account) notFound();

  const access = projectId ? await getProjectAccess(ctx, projectId) : null;
  const canHireHere = access?.can.hire && account.type.canBeHired && account.id !== access.project.accountId;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {access && (
        <Link href={`/projects/${access.project.id}/hire`} className="text-sm text-zinc-600 hover:text-zinc-900">
          ← Back to search
        </Link>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={accountImage(account)} name={account.name} size="lg" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
              <p className="text-sm text-zinc-600">@{account.username}</p>
            </div>
          </div>
          <Badge>{account.type.label}</Badge>
        </div>
        {account.bio && <p className="mt-3 whitespace-pre-line text-zinc-800">{account.bio}</p>}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {account.location && (
            <div>
              <dt className="text-zinc-500">Location</dt>
              <dd className="text-zinc-900">{account.location}</dd>
            </div>
          )}
          {account.email && (
            <div>
              <dt className="text-zinc-500">Email</dt>
              <dd className="break-all text-zinc-900">{account.email}</dd>
            </div>
          )}
          {account.phone && (
            <div>
              <dt className="text-zinc-500">Phone</dt>
              <dd className="text-zinc-900">{account.phone}</dd>
            </div>
          )}
          {account.type.canBeHired && (
            <div>
              <dt className="text-zinc-500">Projects on Pyramid</dt>
              <dd className="text-zinc-900">{account._count.contractsAsContractor}</dd>
            </div>
          )}
        </dl>
      </Card>

      {canHireHere && access && (
        <Card>
          <h2 className="font-semibold">
            Hire {account.name} for {access.project.name}
          </h2>
          <ActionForm action={hireContractor.bind(null, access.project.id, account.id)} className="mt-3 space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-zinc-700">How will you work together?</legend>
              <div className="space-y-2">
                {Object.entries(engagementModels).map(([value, model]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-3 has-[:checked]:border-amber-500 has-[:checked]:ring-2 has-[:checked]:ring-amber-500/30"
                  >
                    <input type="radio" name="engagementModel" value={value} required className="mt-1 accent-amber-500" />
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{model.label}</span>
                      <span className="block text-sm text-zinc-600">{model.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field
              label={`Agreed total budget (${access.project.account.currency}, optional)`}
              hint="Recorded for Full management only. Payments are not tracked yet."
            >
              <input type="number" name="agreedBudget" min={0} step="any" inputMode="decimal" className={inputClass} />
            </Field>
            <Field label="Message (optional)">
              <textarea name="note" rows={2} className={inputClass} />
            </Field>
            <SubmitButton className="w-full sm:w-auto">Hire {account.name}</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
