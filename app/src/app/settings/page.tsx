import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";
import { SignInPrompt } from "@/components/SignInPrompt";
import { SyncCardDatabaseClient } from "./SyncCardDatabaseClient";
import { DeleteAccountClient } from "./DeleteAccountClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Settings
        </h1>
        {!session ? (
          <SignInPrompt
            title="Sign in to open settings"
            description="Manage your account and data from here."
          />
        ) : (
          <>
            <PageDirections
              title="How to use this page"
              steps={[
                "Sync the card database so you can search commanders, build decks, and review collections. Run once after deploy.",
                "Delete your account anytime: type DELETE in the box and click the button. You will be signed out and cannot undo this.",
              ]}
              className="mt-4 mb-8"
            />
            <SyncCardDatabaseClient />
            <DeleteAccountClient />
          </>
        )}
      </main>
    </div>
  );
}
