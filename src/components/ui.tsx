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
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
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
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-10 text-center">
      <p className="font-medium text-zinc-800">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-600">{children}</div>}
    </div>
  );
}
