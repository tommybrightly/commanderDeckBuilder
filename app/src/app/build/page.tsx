import { Header } from "@/components/Header";
import { PageDirections } from "@/components/PageDirections";
import { BuildClient } from "./BuildClient";

export default function BuildPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Build a deck
        </h1>
        <PageDirections
          title="How to use this page"
          steps={[
            "Select a saved collection or paste/upload your card list (text or CSV).",
            "Search and choose your commander.",
            "Pick a deck style (Balanced, Tribal, Spellslinger, Voltron, or Control) to shape creature and spell counts.",
            "Optionally turn off Commander legality for casual play.",
            "Click Build deck. The first time may take a minute while the card database syncs.",
          ]}
          className="mt-4 mb-8"
        />
        <BuildClient />
      </main>
    </div>
  );
}
