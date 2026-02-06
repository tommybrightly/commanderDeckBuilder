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
        <nav className="flex items-center gap-2">
          <Link href="/" className="nav-link nav-link-home">
            Home
          </Link>
          <Link href="/collections" className="nav-link nav-link-collections">
            Collections
          </Link>
          <Link href="/build" className="nav-link nav-link-build">
            Build
          </Link>
          <Link href="/decks" className="nav-link nav-link-decks">
            My Decks
          </Link>
          <Link href="/settings" className="nav-link nav-link-settings">
            Settings
          </Link>
          <span className="ml-2 h-6 w-px bg-[var(--card-border)]" aria-hidden />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
