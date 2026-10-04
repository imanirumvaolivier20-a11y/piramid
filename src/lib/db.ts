import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Unscoped client: bypasses row-level security. Use it only for identity and
 * directory data (User, Account, Membership, AccountType) and for bootstrap
 * steps such as onboarding. Everything tenant-owned goes through `dbFor`.
 */
export const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") globalForDb.prisma = prisma;

/**
 * Tenant-scoped client. Every query runs in a transaction as the
 * `piramid_app` role with `app.user_id` set, so the Postgres policies in
 * prisma/migrations/*_rls_and_account_types limit it to rows the user may see.
 *
 * Do not use interactive transactions on this client; use nested writes.
 */
export function dbFor(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, , result] = await prisma.$transaction([
            prisma.$executeRawUnsafe("SET LOCAL ROLE piramid_app"),
            prisma.$executeRaw`SELECT set_config('app.user_id', ${userId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof dbFor>;
