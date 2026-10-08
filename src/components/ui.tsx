import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

// Inputs use text-base (16px) so iOS does not zoom the page when they are focused.
export const inputClass =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60";

export const buttonClass = {
  primary: `${buttonBase} bg-amber-500 text-zinc-950 hover:bg-amber-400`,
  secondary: `${buttonBase} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50`,
  danger: `${buttonBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
};

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-100 bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-900",
  blue: "bg-sky-100 text-sky-800",
  red: "bg-red-100 text-red-800",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof badgeTones }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-12 text-center">
      <p className="font-medium text-zinc-800">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-600">{children}</div>}
    </div>
  );
}

const avatarSizes = { sm: "h-7 w-7 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" };

/** A logo or profile photo, falling back to initials. */
export function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: keyof typeof avatarSizes }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return src ? (
    // Logos come from an authenticated route and Google photos from Google, so next/image is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={`${avatarSizes[size]} shrink-0 rounded-full border border-zinc-200 bg-white object-cover`}
    />
  ) : (
    <span
      aria-hidden
      className={`${avatarSizes[size]} flex shrink-0 items-center justify-center rounded-full bg-amber-100 font-semibold text-amber-900`}
    >
      {initials}
    </span>
  );
}

/** The round "+" button in the bottom corner for a screen's main action. */
export function Fab({ href, label, icon }: { href: string; label: string; icon?: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed bottom-20 right-4 z-30 flex h-14 items-center gap-2 rounded-2xl bg-amber-500 px-4 font-semibold text-zinc-950 shadow-lg hover:bg-amber-400 sm:bottom-8 sm:right-8"
    >
      {icon ?? <Plus className="h-6 w-6" aria-hidden />}
      <span className="hidden text-sm sm:inline">{label}</span>
    </Link>
  );
}

/** A tappable row with an icon, a title and an optional line below, like a chat list entry. */
export function ListRow({
  href,
  icon,
  title,
  subtitle,
  trailing,
}: {
  href?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  const body = (
    <>
      {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-zinc-900">{title}</span>
        {subtitle && <span className="block truncate text-sm text-zinc-500">{subtitle}</span>}
      </span>
      {trailing}
    </>
  );
  const className = "flex items-center gap-3 px-1 py-3";
  return href ? (
    <Link href={href} className={`${className} rounded-xl hover:bg-zinc-50`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Rounded-square initials, used for projects. */
export function ProjectMark({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const tones = ["bg-amber-100 text-amber-900", "bg-sky-100 text-sky-900", "bg-emerald-100 text-emerald-900", "bg-violet-100 text-violet-900", "bg-rose-100 text-rose-900"];
  const tone = tones[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-2xl font-semibold ${tone} ${size === "lg" ? "h-14 w-14 text-lg" : "h-12 w-12"}`}
    >
      {initials}
    </span>
  );
}
