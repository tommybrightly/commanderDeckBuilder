import { Header } from "@/components/Header";
import { SyncCardsClient } from "./SyncCardsClient";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Sync the card database from Scryfall once (or periodically) so building and searching use local data only.
        </p>
        <SyncCardsClient />
      </main>
    </div>
  );
}
