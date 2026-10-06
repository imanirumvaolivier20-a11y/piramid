import Link from "next/link";
import { removeLogo, updateAccountProfile, updateLogo } from "@/actions/account";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar, Card, Field, PageHeader, inputClass } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
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
        <h2 className="mb-3 font-semibold">{account.type.canBeHired || account.type.canManageWorkers ? "Logo" : "Picture"}</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={accountImage(account)} name={account.name} size="lg" />
          <p className="min-w-0 flex-1 text-sm text-zinc-600">
            {account.logoKey
              ? "Your uploaded image is shown on your profile, in search results and on projects."
              : account.owner.image
                ? "Showing the photo from your Google account. Upload a logo to replace it."
                : "No picture yet. Upload a logo, or sign in with Google to use your Google photo."}
          </p>
        </div>
        {ctx.isManager && (
          <div className="mt-4 flex flex-wrap items-start gap-2">
            {/* Keyed by the logo so the file input clears after an upload. */}
            <ActionForm key={account.logoKey ?? "none"} action={updateLogo} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required className="min-w-0 flex-1 text-sm" />
              <SubmitButton variant="secondary">Upload</SubmitButton>
            </ActionForm>
            {account.logoKey && (
              <form action={removeLogo}>
                <SubmitButton variant="danger">{account.owner.image ? "Use Google photo" : "Remove"}</SubmitButton>
              </form>
            )}
          </div>
        )}
      </Card>

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
