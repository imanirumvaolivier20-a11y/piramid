import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/db";

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

/** Email-only login for local testing. Never available in production builds. */
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";

const providers: Provider[] = [];

if (googleEnabled) providers.push(Google);

if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development login",
      credentials: { email: {} },
      authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
        return { email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user, account }) {
      // `user` is only present on sign-in: make sure our User row exists.
      if (user?.email) {
        const email = user.email.toLowerCase();
        const profile =
          account?.provider === "google"
            ? { name: user.name ?? null, image: user.image ?? null }
            : {};
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: profile,
          create: { email, name: user.name ?? email.split("@")[0], image: user.image ?? null },
        });
        token.uid = dbUser.id;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
