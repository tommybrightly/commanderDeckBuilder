import Link from "next/link";
import { AuthButton } from "./AuthButton";

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-100">
          Commander Deck Builder
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/collections"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Collections
          </Link>
          <Link
            href="/build"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Build
          </Link>
          <Link
            href="/decks"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            My Decks
          </Link>
          <Link
            href="/settings"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Settings
          </Link>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
