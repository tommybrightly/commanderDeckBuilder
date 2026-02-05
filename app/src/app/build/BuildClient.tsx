"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CommanderPicker } from "@/components/CommanderPicker";
import { DeckStats, DeckListByType } from "@/components/DeckStats";
import type { CommanderChoice, DeckArchetype } from "@/lib/mtg/types";
import type { DeckList } from "@/lib/mtg/types";

const ARCHETYPES: { value: DeckArchetype; label: string; hint: string }[] = [
  { value: "balanced", label: "Balanced", hint: "25–30 creatures, general goodstuff" },
  { value: "tribal", label: "Tribal", hint: "30+ creatures, strong theme" },
  { value: "spellslinger", label: "Spellslinger", hint: "Few creatures, many instants/sorceries" },
  { value: "voltron", label: "Voltron", hint: "18–22 creatures, lots of equipment/auras" },
  { value: "control", label: "Control", hint: "16–22 creatures, more removal & draw" },
];

type CollectionRow = { id: string; name: string };

type StreamEvent =
  | { type: "progress"; stage: string; progress: number; message?: string }
  | { type: "result"; deckId: string; deck: DeckList; collectionId?: string }
  | { type: "error"; error: string };

export function BuildClient() {
  const searchParams = useSearchParams();
  const presetCollectionId = searchParams.get("collectionId");

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [source, setSource] = useState<"saved" | "bulk">(presetCollectionId ? "saved" : "saved");
  const [collectionId, setCollectionId] = useState(presetCollectionId ?? "");
  const [rawInput, setRawInput] = useState("");
  const [inputFormat, setInputFormat] = useState<"text" | "csv">("text");
  const [commander, setCommander] = useState<CommanderChoice | null>(null);
  const [archetype, setArchetype] = useState<DeckArchetype>("balanced");
  const [enforceLegality, setEnforceLegality] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deckId: string; deck: DeckList; collectionId?: string } | null>(null);
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
    if (source === "saved" && !collectionId) {
      setError("Choose a collection or paste/upload your bulk above.");
      return;
    }
    if (source === "bulk" && !rawInput.trim()) {
      setError("Paste your list or upload a file.");
      return;
    }
    setError(null);
    setBuilding(true);
    setResult(null);
    setProgress(0);
    setProgressMessage("Starting…");

    try {
      const body: Record<string, unknown> = {
        commander,
        enforceLegality,
        archetype,
      };
      if (source === "saved" && collectionId) {
        body.collectionId = collectionId;
      } else {
        body.rawInput = rawInput.trim();
        body.inputFormat = inputFormat;
      }
      const res = await fetch("/api/build-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            setResult({ deckId: event.deckId, deck: event.deck, collectionId: event.collectionId });
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
  }, [source, collectionId, rawInput, inputFormat, commander, archetype, enforceLegality]);

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
        {result.deck.stats.shortBy != null && result.deck.stats.shortBy > 0 && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            This deck is {result.deck.stats.shortBy} card{result.deck.stats.shortBy === 1 ? "" : "s"} short of 99 (lands are capped at 40). Add more nonland cards to your collection in this commander’s colors and rebuild to fill the deck.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
            <DeckStats
              main={result.deck.main}
              lands={result.deck.lands}
              totalNonlands={result.deck.stats.totalNonlands}
              totalLands={result.deck.stats.totalLands}
              strategyExplanation={result.deck.stats.strategyExplanation}
              compact
            />
          </div>
          <div className="mt-4">
            <DeckListByType main={result.deck.main} lands={result.deck.lands} showRole compact />
          </div>
        </div>
      </div>
    );
  }

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawInput(String(reader.result ?? ""));
      setInputFormat("csv");
    };
    reader.readAsText(file);
  };

  return (
    <div className="mt-6 max-w-xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Your bulk / collection
        </label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setSource("saved")}
            className={`rounded px-3 py-1.5 text-sm ${source === "saved" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            Saved collection
          </button>
          <button
            type="button"
            onClick={() => setSource("bulk")}
            className={`rounded px-3 py-1.5 text-sm ${source === "bulk" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            Paste or upload
          </button>
        </div>
        {source === "saved" ? (
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="mt-2 w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          >
            <option value="">Select a collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInputFormat("text")}
                className={`rounded px-3 py-1.5 text-sm ${inputFormat === "text" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => setInputFormat("csv")}
                className={`rounded px-3 py-1.5 text-sm ${inputFormat === "csv" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                CSV
              </button>
              <label className="cursor-pointer rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900">
                Upload file
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleBulkFile}
                  className="sr-only"
                />
              </label>
            </div>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={inputFormat === "csv" ? "Paste CSV or use Upload file" : "3 Lightning Bolt\n1 Sol Ring (C14)\nBack for More (OTP) 36"}
              rows={6}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Commander
        </label>
        <div className="mt-1">
          <CommanderPicker value={commander} onChange={setCommander} />
        </div>
      </div>
      <div>
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Deck style
        </span>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Adjusts creature counts, spell caps, and what the builder prioritizes.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          {ARCHETYPES.map(({ value, label, hint }) => (
            <label
              key={value}
              className="flex cursor-pointer items-start gap-2 rounded border border-zinc-200 px-3 py-2 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-100 dark:border-zinc-600 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-800"
            >
              <input
                type="radio"
                name="archetype"
                value={value}
                checked={archetype === value}
                onChange={() => setArchetype(value)}
                className="mt-0.5 rounded border-zinc-300"
              />
              <span className="text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
                <span className="ml-1 text-zinc-500 dark:text-zinc-400">— {hint}</span>
              </span>
            </label>
          ))}
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
