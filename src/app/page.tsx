import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { getSessionUser } from "@/lib/session";

const points = [
  { title: "A timeline for every project", text: "Daily reports with photos, materials and wages, in order, signed by who did the work." },
  { title: "Hire and follow", text: "Find a company or engineer, choose how you work together, and watch progress from anywhere." },
  { title: "Money you can account for", text: "Expenses and wages logged against the project the day they happen." },
];

export default async function Home() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-600">Pyramid</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
        See exactly what happened on site, when, and who did it.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-zinc-600">
        The running history of your construction project: daily reports, expenses, materials and wages in one place.
      </p>
      <div className="mt-8">
        <Link href="/login" className={buttonClass.primary}>
          Get started
        </Link>
      </div>

      <ul className="mt-14 grid gap-4 sm:grid-cols-3">
        {points.map((point) => (
          <li key={point.title} className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold text-zinc-900">{point.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{point.text}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
