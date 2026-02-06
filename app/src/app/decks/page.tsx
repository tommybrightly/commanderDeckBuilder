import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";
import { DecksClient } from "./DecksClient";

export default async function DecksPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/");
  }
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          My decks
        </h1>
        <PageDirections
          title="How to use this page"
          steps={[
            "All decks you build are saved here. Each row shows the commander name and last updated date.",
            "Click a deck to open it: view the list by type, stats, strategy notes, and card images.",
            "Copy as text or download a .txt file for use in other apps.",
            "Delete a deck with the Delete button if you no longer need it.",
          ]}
          className="mt-4 mb-8"
        />
        <DecksClient />
      </main>
    </div>
  );
}
