import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";
import { DeleteAccountClient } from "./DeleteAccountClient";

export default function SettingsPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Settings
        </h1>
        <PageDirections
          title="How to use this page"
          steps={[
            "This page lets you permanently delete your account and all associated data (collections and decks).",
            "Type DELETE in the box and click the button to confirm. You will be signed out and cannot undo this.",
          ]}
          className="mt-4 mb-8"
        />
        <DeleteAccountClient />
      </main>
    </div>
  );
}
