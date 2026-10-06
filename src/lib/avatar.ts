/**
 * The picture shown for an account: its uploaded logo, otherwise the owner's
 * Google profile photo. Pass `owner` in the query include to get the fallback.
 */
export function accountImage(account: { logoKey: string | null; owner?: { image: string | null } | null }) {
  if (account.logoKey) return `/api/files/${account.logoKey}`;
  return account.owner?.image ?? null;
}
