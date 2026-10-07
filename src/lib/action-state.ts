import type { ZodError } from "zod";

/** What form actions return to useActionState. */
export type ActionState = { error?: string; success?: string };

export function firstIssue(error: ZodError): ActionState {
  return { error: error.issues[0]?.message ?? "Please check the form." };
}

/** Empty form fields arrive as "", which should be treated as "not provided". */
export function optional(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? undefined : text;
}
