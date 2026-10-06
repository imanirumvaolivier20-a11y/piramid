import { dbFor, prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { readStored } from "@/lib/storage";

/**
 * Serves uploaded photos, receipts and logos. Photo and receipt lookups go
 * through the tenant-scoped client, so they are only returned to users who
 * can access the project they belong to. Logos are part of the public
 * account directory and visible to every signed-in user.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const key = (await params).key.join("/");
  const db = dbFor(user.id);
  const owned = key.startsWith("logos/")
    ? await prisma.account.findUnique({ where: { logoKey: key }, select: { id: true } })
    : (await db.dailyReportPhoto.findUnique({ where: { key }, select: { id: true } })) ??
      (await db.expense.findUnique({ where: { receiptKey: key }, select: { id: true } }));
  if (!owned) return new Response("Not found", { status: 404 });

  const file = await readStored(key);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
