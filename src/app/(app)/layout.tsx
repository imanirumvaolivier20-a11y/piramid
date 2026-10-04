import type { ReactNode } from "react";
import Link from "next/link";
import { switchAccount } from "@/actions/account";
import { signOutAction } from "@/actions/auth";
import { MainNav } from "@/components/nav-links";
import { requireContext } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();

  const links = [
    { href: "/dashboard", label: "Projects" },
    ...(ctx.account.type.canManageWorkers ? [{ href: "/workers", label: "Workers" }] : []),
    { href: "/settings", label: "Account" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            <span className="text-amber-500">▲</span> Pyramid
          </Link>
          <MainNav links={links} />

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {ctx.memberships.length > 1 ? (
              <form action={switchAccount}>
                <select
                  name="accountId"
                  defaultValue={ctx.account.id}
                  aria-label="Switch account"
                  className="max-w-36 truncate rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm sm:max-w-56"
                >
                  {ctx.memberships.map((m) => (
                    <option key={m.accountId} value={m.accountId}>
                      {m.account.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="ml-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                  Switch
                </button>
              </form>
            ) : (
              <span className="truncate text-sm text-zinc-600">{ctx.account.name}</span>
            )}
            <form action={signOutAction}>
              <button type="submit" className="rounded-lg px-2 py-1.5 text-sm text-zinc-600 hover:text-zinc-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Bottom padding keeps content clear of the mobile tab bar. */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 sm:pb-10">{children}</main>
    </>
  );
}
