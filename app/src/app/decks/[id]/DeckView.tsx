"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { DeckStats, DeckListByType } from "@/components/DeckStats";

interface DeckViewProps {
  deckId: string;
  commanderName: string;
  data: {
    commander?: { name: string; imageUrl?: string };
    main?: Array<{ name: string; quantity: number; role?: string; typeLine?: string; cmc?: number; imageUrl?: string; reason?: string }>;
    lands?: Array<{ name: string; quantity: number; imageUrl?: string; reason?: string }>;
    stats?: { totalNonlands: number; totalLands: number; byRole?: Record<string, number>; shortBy?: number; colorIdentity?: string[]; strategyExplanation?: string };
    legalityEnforced?: boolean;
  };
  legalityEnforced: boolean;
  collectionId?: string;
}

export function DeckView({ deckId, commanderName, data, legalityEnforced, collectionId }: DeckViewProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [upgrades, setUpgrades] = useState<Array<{ name: string; impactScore: number; role?: string }>>([]);
  const [upgradesLoading, setUpgradesLoading] = useState(false);

  useEffect(() => {
    if (!collectionId || !deckId) return;
    setUpgradesLoading(true);
    fetch(`/api/decks/${deckId}/upgrade-suggestions?limit=10`)
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body.suggestions)) setUpgrades(body.suggestions);
      })
      .finally(() => setUpgradesLoading(false));
  }, [deckId, collectionId]);
  const main = data?.main ?? [];
  const lands = data?.lands ?? [];
  const stats = data?.stats;

  const copyAsText = () => {
    const lines = [
      `Commander\n1 ${commanderName}`,
      "",
      "Deck",
      ...main.map((c) => (c as { reason?: string }).reason ? `${c.quantity} ${c.name}  # ${(c as { reason?: string }).reason}` : `${c.quantity} ${c.name}`),
      ...lands.map((c) => (c as { reason?: string }).reason ? `${c.quantity} ${c.name}  # ${(c as { reason?: string }).reason}` : `${c.quantity} ${c.name}`),
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
  };

  const downloadTxt = () => {
    const lines = [
      `Commander\n1 ${commanderName}`,
      "",
      "Deck",
      ...main.map((c) => (c as { reason?: string }).reason ? `${c.quantity} ${c.name}  # ${(c as { reason?: string }).reason}` : `${c.quantity} ${c.name}`),
      ...lands.map((c) => (c as { reason?: string }).reason ? `${c.quantity} ${c.name}  # ${(c as { reason?: string }).reason}` : `${c.quantity} ${c.name}`),
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
      <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
        {commanderName}
      </h1>
      {!legalityEnforced && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          Legality checks were off for this build.
        </p>
      )}
      {stats?.shortBy != null && stats.shortBy > 0 && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          This deck is {stats.shortBy} card{stats.shortBy === 1 ? "" : "s"} short of 99 (lands were capped at 40). Add more nonland cards and rebuild to fill the deck.
        </p>
      )}
      <div className="card mt-4 bg-[var(--background)]/50 p-4">
        <DeckStats
          main={main}
          lands={lands}
          totalNonlands={stats?.totalNonlands}
          totalLands={stats?.totalLands}
          strategyExplanation={stats?.strategyExplanation}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyAsText}
          className="btn-secondary text-sm"
        >
          Copy as text
        </button>
        <button
          type="button"
          onClick={downloadTxt}
          className="btn-secondary text-sm"
        >
          Download .txt
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary ml-auto border-red-200 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete deck"}
        </button>
      </div>
      <section className="mt-6" aria-label="Deck list by type">
        <h2 className="mb-4 text-xl font-semibold text-[var(--foreground)]">
          Deck list
        </h2>
        <DeckListByType main={main} lands={lands} showRole showReason />
      </section>
      {collectionId && (
        <section className="mt-6" aria-label="Upgrade suggestions">
          <h2 className="mb-2 text-xl font-semibold text-[var(--foreground)]">
            Upgrade path
          </h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Top cards from this collection not in the deck, ranked by impact if you added them.
          </p>
          {upgradesLoading ? (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          ) : upgrades.length > 0 ? (
            <ul className="card list-inside list-disc space-y-1 p-4 text-sm">
              {upgrades.map((u) => (
                <li key={u.name}>
                  <span className="font-medium text-[var(--foreground)]">{u.name}</span>
                  {u.role && <span className="text-[var(--muted)]"> — {u.role}</span>}
                  <span className="text-[var(--muted)]"> (impact {u.impactScore.toFixed(2)})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">No suggestions or deck was built from a pasted list.</p>
          )}
        </section>
      )}
    </div>
  );
}
