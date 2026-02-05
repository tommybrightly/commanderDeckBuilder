"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeckStats, DeckListByType } from "@/components/DeckStats";

interface DeckViewProps {
  deckId: string;
  commanderName: string;
  data: {
    commander?: { name: string; imageUrl?: string };
    main?: Array<{ name: string; quantity: number; role?: string; typeLine?: string; cmc?: number; imageUrl?: string }>;
    lands?: Array<{ name: string; quantity: number; imageUrl?: string }>;
    stats?: { totalNonlands: number; totalLands: number; byRole?: Record<string, number> };
    legalityEnforced?: boolean;
  };
  legalityEnforced: boolean;
}

export function DeckView({ deckId, commanderName, data, legalityEnforced }: DeckViewProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const main = data?.main ?? [];
  const lands = data?.lands ?? [];
  const stats = data?.stats;

  const copyAsText = () => {
    const lines = [
      `Commander\n1 ${commanderName}`,
      "",
      "Deck",
      ...main.map((c) => `${c.quantity} ${c.name}`),
      ...lands.map((c) => `${c.quantity} ${c.name}`),
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  };

  const downloadTxt = () => {
    const lines = [
      `Commander\n1 ${commanderName}`,
      "",
      "Deck",
      ...main.map((c) => `${c.quantity} ${c.name}`),
      ...lands.map((c) => `${c.quantity} ${c.name}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${commanderName.replace(/\s+/g, "-")}-deck.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete this deck (“${commanderName}”)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/decks");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {commanderName}
      </h1>
      {!legalityEnforced && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          Legality checks were off for this build.
        </p>
      )}
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <DeckStats
          main={main}
          lands={lands}
          totalNonlands={stats?.totalNonlands}
          totalLands={stats?.totalLands}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyAsText}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          Copy as text
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          Download .txt
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto rounded border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete deck"}
        </button>
      </div>
      <section className="mt-6" aria-label="Deck list by type">
        <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Deck list
        </h2>
        <DeckListByType main={main} lands={lands} showRole />
      </section>
    </div>
  );
}
