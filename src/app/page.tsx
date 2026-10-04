export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Pyramid</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Construction site project management.
      </p>
      <p className="font-mono text-sm text-zinc-500">
        version {process.env.APP_VERSION ?? "dev"}
      </p>
    </main>
  );
}
