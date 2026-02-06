import Link from "next/link";
import { AuthButton } from "./AuthButton";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--card-border)] bg-[var(--card)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-semibold text-[var(--foreground)] transition opacity-90 hover:opacity-100"
        >
          Commander Deck Builder
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/collections"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            Collections
          </Link>
          <Link
            href="/build"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            Build
          </Link>
          <Link
            href="/decks"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            My Decks
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)] dark:hover:bg-white/5"
          >
            Settings
          </Link>
          <span className="ml-2 h-6 w-px bg-[var(--card-border)]" aria-hidden />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
