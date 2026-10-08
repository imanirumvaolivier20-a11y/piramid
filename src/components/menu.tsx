"use client";

import { EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { type ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";

const CloseMenu = createContext<() => void>(() => {});

/** The "⋮" button that opens a small menu of less frequent actions. */
export function MoreMenu({ children, label = "More options" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 hover:bg-zinc-100"
      >
        <EllipsisVertical className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 min-w-56 overflow-hidden rounded-xl border border-zinc-100 bg-white py-1 shadow-lg"
        >
          <CloseMenu.Provider value={() => setOpen(false)}>{children}</CloseMenu.Provider>
        </div>
      )}
    </div>
  );
}

const itemClass = "flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-zinc-50";

export function MenuLink({
  href,
  icon,
  children,
  external,
}: {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  external?: boolean;
}) {
  const close = useContext(CloseMenu);
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={close}
      target={external ? "_blank" : undefined}
      className={`${itemClass} text-zinc-800`}
    >
      <span className="text-zinc-500">{icon}</span>
      {children}
    </Link>
  );
}

/** A menu item that submits a server action. */
export function MenuAction({
  action,
  icon,
  children,
  danger,
  checked,
}: {
  action: () => void | Promise<void>;
  icon?: ReactNode;
  children: ReactNode;
  danger?: boolean;
  checked?: boolean;
}) {
  const close = useContext(CloseMenu);
  return (
    <form action={action} onSubmit={close}>
      <button type="submit" role="menuitem" className={`${itemClass} ${danger ? "text-red-700" : "text-zinc-800"}`}>
        <span className={danger ? "text-red-600" : "text-zinc-500"}>{icon}</span>
        <span className="flex-1">{children}</span>
        {checked && <span className="text-amber-600">✓</span>}
      </button>
    </form>
  );
}

export function MenuDivider() {
  return <div className="my-1 border-t border-zinc-100" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">{children}</p>;
}
