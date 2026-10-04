"use server";

import { AuthError } from "next-auth";
import type { ActionState } from "@/lib/action-state";
import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function devSignIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("dev", { email: formData.get("email"), redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Enter a valid email address." };
    throw error; // the redirect on success
  }
  return {};
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
