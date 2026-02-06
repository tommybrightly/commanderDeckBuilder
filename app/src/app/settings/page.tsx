import { Header } from "@/components/Header";
import { DeleteAccountClient } from "./DeleteAccountClient";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
        <DeleteAccountClient />
      </main>
    </div>
  );
}
