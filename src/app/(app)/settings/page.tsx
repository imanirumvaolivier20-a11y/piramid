import Link from "next/link";
import { updateAccountProfile } from "@/actions/account";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, PageHeader, inputClass } from "@/components/ui";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Account · Pyramid" };

export default async function SettingsPage() {
  const ctx = await requireContext();
  const { account } = ctx;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="Account"
        subtitle={
          <>
            {account.type.label} · @{account.username} ·{" "}
            <Link href={`/accounts/${account.username}`} className="underline">
              View public profile
            </Link>
          </>
        }
      />

      <Card>
        <h2 className="mb-3 font-semibold">Public profile</h2>
        {ctx.isManager ? (
          <ActionForm action={updateAccountProfile} className="space-y-4">
            <Field label="Name">
              <input name="name" required defaultValue={account.name} className={inputClass} />
            </Field>
            <Field label="Contact email" hint="Owners can find you by this email when hiring.">
              <input type="email" name="email" defaultValue={account.email ?? ""} className={inputClass} />
            </Field>
            <Field label="Phone">
              <input type="tel" name="phone" defaultValue={account.phone ?? ""} className={inputClass} />
            </Field>
            <Field label="Location">
              <input name="location" defaultValue={account.location ?? ""} className={inputClass} />
            </Field>
            <Field label="About">
              <textarea name="bio" rows={4} defaultValue={account.bio ?? ""} className={inputClass} />
            </Field>
            <SubmitButton>Save profile</SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-zinc-600">Only the owners and admins of {account.name} can edit its profile.</p>
        )}
      </Card>

      {account.inviteCode && ctx.isManager && (
        <Card>
          <h2 className="font-semibold">Invite code</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Workers who choose “Construction Company Worker” when they sign up can enter this code to join {account.name}.
          </p>
          <p className="mt-3 font-mono text-2xl font-semibold tracking-widest">{account.inviteCode}</p>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Signed in as</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {ctx.user.name} · {ctx.user.email}
        </p>
      </Card>
    </div>
  );
}
