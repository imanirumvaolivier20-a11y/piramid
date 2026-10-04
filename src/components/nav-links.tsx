"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string; exact?: boolean };

function useIsActive() {
  const pathname = usePathname();
  return (link: NavLink) => (link.exact ? pathname === link.href : pathname.startsWith(link.href));
}

/** Main navigation: a bottom tab bar on phones, inline links from tablet width up. */
export function MainNav({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  return (
    <>
      <nav className="hidden gap-1 sm:flex" aria-label="Main">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(link) ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
        aria-label="Main"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-h-14 flex-1 items-center justify-center text-sm font-medium ${
              isActive(link) ? "border-t-2 border-amber-500 text-zinc-900" : "border-t-2 border-transparent text-zinc-500"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/** Horizontal, scrollable tabs used inside a project. */
export function Tabs({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-zinc-200 px-4" aria-label="Project">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
            isActive(link) ? "border-amber-500 text-zinc-900" : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
