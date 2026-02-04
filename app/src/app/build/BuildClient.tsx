"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommanderPicker } from "@/components/CommanderPicker";
import type { CommanderChoice } from "@/lib/mtg/types";
import type { DeckList } from "@/lib/mtg/types";

type CollectionRow = { id: string; name: string };

type StreamEvent =
  | { type: "progress"; stage: string; progress: number; message?: string }
  | { type: "result"; deckId: string; deck: DeckList }
  | { type: "error"; error: string };

export function BuildClient() {
  const searchParams = useSearchParams();
  const presetCollectionId = searchParams.get("collectionId");

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [collectionId, setCollectionId] = useState(presetCollectionId ?? "");
  const [commander, setCommander] = useState<CommanderChoice | null>(null);
  const [enforceLegality, setEnforceLegality] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deckId: string; deck: DeckList } | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCollections(data);
      });
  }, []);

  useEffect(() => {
    if (presetCollectionId) setCollectionId(presetCollectionId);
  }, [presetCollectionId]);

  const build = useCallback(async () => {
    if (!commander) {
      setError("Choose a commander.");
      return;
    }
    if (!collectionId) {
      setError("Choose a collection.");
      return;
    }
    setError(null);
    setBuilding(true);
    setResult(null);
    setProgress(0);
    setProgressMessage("Starting…");

    try {
      const res = await fetch("/api/build-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          commander,
          enforceLegality,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Build failed");
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(trimmed) as StreamEvent;
          } catch {
            continue;
          }
          if (event.type === "progress") {
            setProgress(event.progress);
            setProgressMessage(event.message ?? event.stage);
          } else if (event.type === "result") {
            setResult({ deckId: event.deckId, deck: event.deck });
            setProgress(1);
            setProgressMessage("Done");
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }, [collectionId, commander, enforceLegality]);

  if (result) {
    return (
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Deck built
        </h2>
        {!result.deck.legalityEnforced && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            Legality checks were off — this list may include banned cards.
          </p>
        )}
        <div className="mt-4 flex gap-4">
          <a
            href={`/decks/${result.deckId}`}
            className="rounded bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            View saved deck
          </a>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-600"
          >
            Build another
          </button>
        </div>
        <div className="mt-6 rounded border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="font-medium">Commander: {result.deck.commander.name}</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Nonlands: {result.deck.stats.totalNonlands} · Lands: {result.deck.stats.totalLands}
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Spells</h3>
              <ul className="mt-1 max-h-48 overflow-auto text-sm">
                {result.deck.main.map((c, i) => (
                  <li key={`${c.name}-${i}`}>
                    {c.quantity}x {c.name}
                    {c.role && <span className="text-zinc-500"> ({c.role})</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Lands</h3>
              <ul className="mt-1 max-h-48 overflow-auto text-sm">
                {result.deck.lands.map((c, i) => (
                  <li key={`${c.name}-${i}`}>
                    {c.quantity}x {c.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Collection
        </label>
        <select
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
        >
          <option value="">Select a collection</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Commander
        </label>
        <div className="mt-1">
          <CommanderPicker value={commander} onChange={setCommander} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="legality"
          checked={enforceLegality}
          onChange={(e) => setEnforceLegality(e.target.checked)}
          className="rounded border-zinc-300"
        />
        <label htmlFor="legality" className="text-sm text-zinc-700 dark:text-zinc-300">
          Enforce Commander legality / banlist (turn off for casual play)
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {building && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
            <span>{progressMessage}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 ease-out dark:bg-zinc-100"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={build}
        disabled={building}
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {building ? "Building…" : "Build deck"}
      </button>
    </div>
  );
}
