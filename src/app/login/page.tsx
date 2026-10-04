import { redirect } from "next/navigation";
import { devSignIn } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { GoogleButton } from "@/components/google-button";
import { Card, Field, inputClass } from "@/components/ui";
import { devLoginEnabled, googleEnabled } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Sign in · Pyramid" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Pyramid</h1>
      <p className="mt-1 text-sm text-zinc-600">New here? Signing in creates your account.</p>

      <Card className="mt-6 space-y-4">
        {googleEnabled ? (
          <GoogleButton />
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Google sign-in is not configured on this server yet. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (see the
            README).
          </p>
        )}

        {devLoginEnabled && (
          <ActionForm action={devSignIn} className="space-y-3 border-t border-zinc-200 pt-4">
            <Field label="Development login" hint="Local testing only. Try owner@demo.test or company@demo.test after seeding.">
              <input type="email" name="email" required placeholder="you@example.com" className={inputClass} />
            </Field>
            <SubmitButton variant="secondary" className="w-full">
              Sign in with email
            </SubmitButton>
          </ActionForm>
        )}
      </Card>
    </main>
  );
}
