import { redirect } from "next/navigation";
import { signOutAction } from "@/actions/auth";
import { OnboardingForm } from "@/components/onboarding-form";
import { prisma } from "@/lib/db";
import { currencies } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Welcome · Pyramid" };

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await prisma.membership.count({ where: { userId: user.id } })) redirect("/dashboard");

  const types = await prisma.accountType.findMany({
    where: { selectable: true },
    orderBy: { sortOrder: "asc" },
    select: { key: true, label: true, description: true },
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Pyramid</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Signed in as {user.email}.{" "}
        <button type="submit" form="sign-out" className="underline">
          Use another account
        </button>
      </p>
      <form id="sign-out" action={signOutAction} />

      <OnboardingForm types={types} currencies={currencies} suggestedName={user.name ?? ""} />
    </main>
  );
}
