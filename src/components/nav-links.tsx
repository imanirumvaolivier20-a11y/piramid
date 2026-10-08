"use client";

import {
  Activity,
  CalendarCheck,
  FolderKanban,
  HandCoins,
  House,
  Package,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Icons are looked up by name here, because components cannot be passed from
// server components to client components.
const icons = {
  projects: FolderKanban,
  account: UserRound,
  home: House,
  activity: Activity,
  materials: Package,
  workers: Users,
  money: Wallet,
  attendance: CalendarCheck,
  payroll: HandCoins,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;
export type NavLink = { href: string; label: string; icon?: IconName; exact?: boolean; also?: string[] };

/** Inside a project, the project's own tabs replace the main menu. */
const PROJECT_PATH = /^\/projects\/(?!new$)[^/]+/;

function useIsActive() {
  const pathname = usePathname();
  return (link: NavLink) =>
    link.exact
      ? pathname === link.href
      : [link.href, ...(link.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function useInProject() {
  return PROJECT_PATH.test(usePathname());
}

function Icon({ name, className }: { name?: IconName; className?: string }) {
  if (!name) return null;
  const Component = icons[name];
  return <Component className={className} aria-hidden />;
}

/** Bottom tab bar on phones. */
function BottomBar({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-100 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label="Main"
    >
      {links.map((link) => {
        const active = isActive(link);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ${
              active ? "text-zinc-900" : "text-zinc-500"
            }`}
          >
            <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-amber-100" : ""}`}>
              <Icon name={link.icon} className="h-5 w-5" />
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Main menu: inline links on wide screens, a bottom bar on phones (hidden inside a project). */
export function MainNav({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  const inProject = useInProject();
  return (
    <>
      <nav className="hidden gap-1 sm:flex" aria-label="Main">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              isActive(link) ? "bg-amber-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            <Icon name={link.icon} className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>
      {!inProject && <BottomBar links={links} />}
    </>
  );
}

/** The site header; on phones it gives way to the project's own bar inside a project. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const inProject = useInProject();
  return (
    <header className={`sticky top-0 z-20 border-b border-zinc-100 bg-white/95 backdrop-blur ${inProject ? "hidden sm:block" : ""}`}>
      {children}
    </header>
  );
}

/** A project's sections: tabs under the header on wide screens, a bottom bar on phones. */
export function ProjectTabs({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  return (
    <>
      <nav className="-mx-4 hidden gap-1 border-b border-zinc-100 px-4 sm:flex" aria-label="Project">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${
              isActive(link) ? "border-amber-500 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Icon name={link.icon} className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </nav>
      <BottomBar links={links} />
    </>
  );
}

/** Pill switcher for the parts of one section, e.g. Attendance / Team / Payroll. */
export function SubTabs({ links }: { links: NavLink[] }) {
  const isActive = useIsActive();
  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Section">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            isActive(link) ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          <Icon name={link.icon} className="h-4 w-4" />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
