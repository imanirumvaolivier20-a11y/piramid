import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.APP_VERSION ?? "dev";
  try {
    await db.query("SELECT 1");
    return Response.json({ status: "ok", db: "up", version });
  } catch {
    return Response.json({ status: "error", db: "down", version }, { status: 503 });
  }
}
