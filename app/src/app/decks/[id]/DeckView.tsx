"use client";

import type { DeckList } from "@/lib/mtg/types";

interface DeckViewProps {
  commanderName: string;
  data: {
    commander?: { name: string; imageUrl?: string };
    main?: Array<{ name: string; quantity: number; role?: string }>;
    lands?: Array<{ name: string; quantity: number }>;
    stats?: { totalNonlands: number; totalLands: number; byRole?: Record<string, number> };
    legalityEnforced?: boolean;
  };
  legalityEnforced: boolean;
}

export function DeckView({ commanderName, data, legalityEnforced }: DeckViewProps) {
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
      {stats && (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {stats.totalNonlands} nonlands, {stats.totalLands} lands
        </p>
      )}
      <div className="mt-4 flex gap-2">
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
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Spells ({main.length})
          </h2>
          <ul className="mt-2 max-h-96 overflow-auto rounded border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            {main.map((c, i) => (
              <li key={`${c.name}-${i}`} className="text-sm">
                {c.quantity}x {c.name}
                {c.role && <span className="text-zinc-500"> — {c.role}</span>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
            Lands ({lands.length})
          </h2>
          <ul className="mt-2 max-h-96 overflow-auto rounded border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            {lands.map((c, i) => (
              <li key={`${c.name}-${i}`} className="text-sm">
                {c.quantity}x {c.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
