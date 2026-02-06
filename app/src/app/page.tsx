import Link from "next/link";
import { Header } from "@/components/Header";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-4 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Build Commander decks from your bulk
          </h1>
          <p className="mt-5 text-xl leading-relaxed text-[var(--muted)]">
            Add your collection, pick a commander, and get a tuned 100-card deck built only from cards you own.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/build" className="btn-primary inline-block">
              Build a deck
            </Link>
            <Link href="/collections" className="btn-secondary inline-block">
              My collections
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-3xl px-4 py-12">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            How it works
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--accent)]">
                1
              </span>
              <h3 className="mt-3 font-semibold text-[var(--foreground)]">Add your cards</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Paste a list or upload a CSV on Collections, or paste when you build. Your collection stays in your account.
              </p>
            </div>
            <div className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--accent)]">
                2
              </span>
              <h3 className="mt-3 font-semibold text-[var(--foreground)]">Pick a commander</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Choose your commander and deck style (tribal, spellslinger, voltron, and more). We build around their abilities.
              </p>
            </div>
            <div className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)]/20 text-sm font-bold text-[var(--accent)]">
                3
              </span>
              <h3 className="mt-3 font-semibold text-[var(--foreground)]">Get your deck</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                We pick the best 99 from your pool—ramp, draw, removal, and synergy with your commander. Save and tweak in My Decks.
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="mx-auto max-w-3xl px-4 pb-20">
          <div className="card border-[var(--accent)]/30 bg-[var(--card)]/60 px-6 py-8 text-center">
            <p className="text-lg font-medium text-[var(--foreground)]">
              Ready to build?
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sign in with Google to save collections and decks.
            </p>
            <Link href="/build" className="btn-primary mt-5 inline-block">
              Build a deck
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
