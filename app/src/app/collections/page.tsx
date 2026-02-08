import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";
import { SignInPrompt } from "@/components/SignInPrompt";
import { CollectionsClient } from "./CollectionsClient";

export default async function CollectionsPage() {
  const session = await getServerSession(authOptions);
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          My collections
        </h1>
        {!session ? (
          <SignInPrompt
            title="Sign in to view your collections"
            description="Save and manage card lists, then use them when building decks."
          />
        ) : (
          <>
            <PageDirections
              title="How to use this page"
              steps={[
                "Give your collection a name, then paste a card list (e.g. \"3 Lightning Bolt\") or upload a CSV (e.g. from ManaBox).",
                "Click Save collection to store it. You can have multiple collections.",
                "Use a collection when building a deck on the Build page—select it from the dropdown.",
                "Delete a collection anytime with the Delete button; this does not affect decks already built from it.",
              ]}
              className="mt-4 mb-8"
            />
            <CollectionsClient />
          </>
        )}
      </main>
    </div>
  );
}
