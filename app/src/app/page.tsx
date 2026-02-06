import Link from "next/link";
import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-12">
        <PageDirections
          title="How to use this site"
          steps={[
            "Sign in with Google to save collections and decks.",
            "Add a collection (paste a list or upload CSV) on Collections, or paste/upload when building.",
            "Go to Build, choose a collection or paste cards, pick a commander and deck style, then click Build deck.",
            "View and manage your decks under My Decks.",
          ]}
          className="mb-8"
        />
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Build a Commander deck from your bulk
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-[var(--muted)]">
          Add your collection, pick a commander, and get a 100-card deck built only from cards you own. Choose a deck style (tribal, spellslinger, voltron, and more) and optionally turn off legality for casual play.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/collections" className="btn-primary inline-block">
            My collections
          </Link>
          <Link href="/build" className="btn-secondary inline-block">
            Build a deck
          </Link>
        </div>
      </main>
    </div>
  );
}
