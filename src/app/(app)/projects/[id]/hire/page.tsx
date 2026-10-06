import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, Badge, Card, EmptyState, buttonClass, inputClass } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
import { getProjectAccess } from "@/lib/access";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Hire · Pyramid" };

export default async function HirePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const query = ((await searchParams).q ?? "").trim();
  const ctx = await requireContext();
  const { project, can } = await getProjectAccess(ctx, id);
  if (!can.hire) redirect(`/projects/${id}`);

  // Account profiles are a public directory, so this search is not tenant-scoped.
  const results =
    query.length >= 2
      ? await prisma.account.findMany({
          where: {
            id: { not: project.accountId },
            type: { canBeHired: true },
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          },
          include: { type: true, owner: { select: { image: true } } },
          orderBy: { name: "asc" },
          take: 20,
        })
      : [];

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-lg font-semibold">Hire Engineer or Company</h2>
      <p className="mt-1 text-sm text-zinc-600">Search by username, email or name, then open a profile to hire.</p>

      <form className="mt-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="e.g. kigali-builders or name@example.com"
          aria-label="Search companies and engineers"
          className={inputClass}
        />
        <button type="submit" className={buttonClass.primary}>
          Search
        </button>
      </form>

      <div className="mt-5">
        {query.length >= 2 && results.length === 0 && (
          <EmptyState title="No company or engineer found">Check the spelling, or ask them for their Pyramid username.</EmptyState>
        )}
        <ul className="space-y-3">
          {results.map((account) => (
            <li key={account.id}>
              <Link href={`/accounts/${account.username}?project=${id}`} className="block">
                <Card className="hover:border-amber-400">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={accountImage(account)} name={account.name} />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-zinc-900">{account.name}</h3>
                        <p className="text-sm text-zinc-600">
                          @{account.username}
                          {account.location && ` · ${account.location}`}
                        </p>
                      </div>
                    </div>
                    <Badge>{account.type.label}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
