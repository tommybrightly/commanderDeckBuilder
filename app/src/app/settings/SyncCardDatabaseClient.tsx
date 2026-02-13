"use client";

import { useState } from "react";

export function SyncCardDatabaseClient() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setProgress(0);
    setMessage("");
    setDone(null);
    setError(null);
    try {
      const res = await fetch("/api/cards/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync request failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");
      let buffer = "";
      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as { type: string; message?: string; progress?: number; count?: number; error?: string };
            if (event.type === "progress") {
              setMessage(event.message ?? "");
              setProgress(event.progress ?? 0);
            } else if (event.type === "done") {
              setProgress(1);
              setMessage(event.message ?? "Done");
              setDone({ count: event.count ?? 0 });
            } else if (event.type === "error") {
              setError(event.error ?? "Sync failed");
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="card mt-6 p-6">
      <h2 className="text-lg font-medium text-[var(--foreground)]">
        Card database
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Sync cards from Scryfall so you can search commanders, build decks, and review collections. Run this once after deploy, or again to refresh card data (e.g. new sets).
      </p>
      <button
        type="button"
        onClick={handleSync}
        disabled={syncing}
        className="btn-primary mt-4"
      >
        {syncing ? "Syncing…" : "Sync card database"}
      </button>
      {syncing && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[var(--muted)]" title={message}>
              {message || "Starting…"}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--muted)]">{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--card-border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>
      )}
      {done && !syncing && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400">
          {done.count.toLocaleString()} cards in database.
        </p>
      )}
      {error && !syncing && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
