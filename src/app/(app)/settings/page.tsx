import { ArrowLeftRight, ChevronRight, HandCoins, KeyRound, LogOut, Mail, MapPin, Phone, SlidersHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { removeLogo, switchAccount, updateAccountProfile, updateLogo } from "@/actions/account";
import { signOutAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MenuAction, MenuDivider, MenuLabel, MenuLink, MoreMenu } from "@/components/menu";
import { Avatar, Field, inputClass } from "@/components/ui";
import { accountImage } from "@/lib/avatar";
import { requireContext } from "@/lib/session";

export const metadata = { title: "Account · Pyramid" };

const icon = "h-4 w-4";

export default async function SettingsPage() {
  const ctx = await requireContext();
  const { account } = ctx;
  const others = ctx.memberships.filter((m) => m.accountId !== account.id);
  const employed = (await ctx.db.worker.count({ where: { userId: ctx.user.id } })) > 0;
  const managesWorkers = account.type.canManageWorkers && ctx.isManager;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <MoreMenu label="Account options">
          {others.length > 0 && <MenuLabel>Switch to</MenuLabel>}
          {others.map((m) => (
            <MenuAction key={m.accountId} action={switchAccount.bind(null, m.accountId)} icon={<ArrowLeftRight className={icon} />}>
              {m.account.name}
            </MenuAction>
          ))}
          {others.length > 0 && <MenuDivider />}
          {employed && (
            <MenuLink href="/my-pay" icon={<HandCoins className={icon} />}>
              My pay
            </MenuLink>
          )}
          {managesWorkers && (
            <MenuLink href="/workers" icon={<SlidersHorizontal className={icon} />}>
              Workers and daily rates
            </MenuLink>
          )}
          <MenuLink href={`/accounts/${account.username}`} icon={<UserRound className={icon} />}>
            View public profile
          </MenuLink>
          <MenuDivider />
          <MenuAction action={signOutAction} danger icon={<LogOut className={icon} />}>
            Sign out
          </MenuAction>
        </MoreMenu>
      </div>

      {/* Profile card, like the top of a contact page. */}
      <div className="flex flex-col items-center text-center">
        <Avatar src={accountImage(account)} name={account.name} size="lg" />
        <p className="mt-3 text-xl font-semibold">{account.name}</p>
        <p className="text-sm text-zinc-500">
          @{account.username} · {account.type.label}
        </p>
        {ctx.isManager && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <ActionForm key={account.logoKey ?? "none"} action={updateLogo} className="flex items-center gap-2">
              <label className="cursor-pointer rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200">
                {account.logoKey ? "Change logo" : "Upload logo"}
                <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required className="sr-only" />
              </label>
              <SubmitButton variant="secondary" className="min-h-9 rounded-full py-1">
                Save
              </SubmitButton>
            </ActionForm>
            {account.logoKey && (
              <form action={removeLogo}>
                <button type="submit" className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">
                  {account.owner.image ? "Use Google photo" : "Remove logo"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <ul className="rounded-2xl bg-zinc-50 px-4">
        {[
          { icon: Mail, value: account.email },
          { icon: Phone, value: account.phone },
          { icon: MapPin, value: account.location },
        ]
          .filter((row) => row.value)
          .map((row) => (
            <li key={row.value} className="flex items-center gap-3 border-b border-zinc-100 py-3 text-sm last:border-0">
              <row.icon className="h-4 w-4 text-zinc-400" aria-hidden />
              <span className="truncate">{row.value}</span>
            </li>
          ))}
        <li className="flex items-center gap-3 py-3 text-sm text-zinc-500">
          <UserRound className="h-4 w-4 text-zinc-400" aria-hidden />
          Signed in as {ctx.user.email}
        </li>
      </ul>

      {account.inviteCode && ctx.isManager && (
        <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4">
          <KeyRound className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-500">Invite code for workers</p>
            <p className="font-mono text-xl font-semibold tracking-widest">{account.inviteCode}</p>
          </div>
        </div>
      )}

      {employed && (
        <Link href="/my-pay" className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 hover:bg-zinc-100">
          <HandCoins className="h-5 w-5 text-zinc-500" aria-hidden />
          <span className="flex-1 font-medium">My pay</span>
          <ChevronRight className="h-4 w-4 text-zinc-400" aria-hidden />
        </Link>
      )}

      {ctx.isManager && (
        <details className="rounded-2xl bg-zinc-50 p-4">
          <summary className="cursor-pointer font-medium">Edit profile</summary>
          <ActionForm action={updateAccountProfile} className="mt-4 space-y-4">
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
            <SubmitButton className="w-full">Save profile</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
