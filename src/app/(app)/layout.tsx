import type { ReactNode } from "react";
import Link from "next/link";
import { HeaderShell, MainNav, type NavLink } from "@/components/nav-links";
import { Avatar } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
import { requireContext } from "@/lib/session";

// The main menu is deliberately short: everything else lives inside a project
// or behind the "⋮" menu of the Account page.
const links: NavLink[] = [
  { href: "/dashboard", label: "Projects", icon: "projects", also: ["/projects"] },
  { href: "/settings", label: "Account", icon: "account", also: ["/workers", "/my-pay"] },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireContext();

  return (
    <>
      <HeaderShell>
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-4 px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            <span className="text-amber-500">▲</span> Pyramid
          </Link>
          <MainNav links={links} />
          <Link href="/settings" className="ml-auto flex min-w-0 items-center gap-2" aria-label="Account">
            <span className="hidden truncate text-sm text-zinc-600 sm:inline">{ctx.account.name}</span>
            <Avatar src={accountImage(ctx.account)} name={ctx.account.name} size="sm" />
          </Link>
        </div>
      </HeaderShell>

      {/* Bottom padding keeps content clear of the phone tab bar and the + button. */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-36 pt-4 sm:pb-28">{children}</main>
    </>
  );
}
