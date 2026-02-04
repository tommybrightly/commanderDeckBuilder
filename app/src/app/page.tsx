import Link from "next/link";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Build a Commander deck from your bulk
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Add your collection (paste a list or upload CSV), pick a commander, and get a 100-card deck built only from cards you own. You can turn off legality checks for casual play.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/collections"
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            My collections
          </Link>
          <Link
            href="/build"
            className="rounded-md border border-zinc-300 px-4 py-2 font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Build a deck
          </Link>
        </div>
      </main>
    </div>
  );
}
