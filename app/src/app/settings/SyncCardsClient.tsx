"use client";

import { useCallback, useState } from "react";

type SyncEvent =
  | { type: "progress"; message?: string; progress?: number; done?: number; total?: number }
  | { type: "done"; count: number; message?: string }
  | { type: "error"; error: string };

export function SyncCardsClient() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const sync = useCallback(async () => {
    setError(null);
    setSyncing(true);
    setProgress(0);
    setMessage("Starting…");

    try {
      const res = await fetch("/api/cards/sync", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Sync failed");
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
          let event: SyncEvent;
          try {
            event = JSON.parse(trimmed) as SyncEvent;
          } catch {
            continue;
          }
          if (event.type === "progress") {
            setMessage(event.message ?? "");
            if (typeof event.progress === "number") setProgress(event.progress);
          } else if (event.type === "done") {
            setLastCount(event.count);
            setMessage(event.message ?? "Done.");
            setProgress(1);
          } else if (event.type === "error") {
            setError(event.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
        Card database
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Download all MTG cards from Scryfall into this app. Do this once before building decks, and periodically to stay updated. Building and commander search then use only this local data.
      </p>
      {lastCount != null && !syncing && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Last sync: {lastCount.toLocaleString()} cards in database.
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {syncing && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
            <span>{message}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-zinc-900 transition-[width] duration-300 ease-out dark:bg-zinc-100"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={sync}
        disabled={syncing}
        className="mt-4 rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {syncing ? "Syncing…" : "Sync card database"}
      </button>
    </div>
  );
}
