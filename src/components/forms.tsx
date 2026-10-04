"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "@/components/ui";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** A form bound to a server action that shows the error the action returns. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <FormError message={state.error} />
    </form>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof buttonClass;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass[variant]} ${className}`}>
      {pending ? "Please wait…" : children}
    </button>
  );
}
