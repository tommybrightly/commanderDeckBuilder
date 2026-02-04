"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DeckRow = {
  id: string;
  commanderName: string;
  legalityEnforced: boolean;
  createdAt: string;
  updatedAt: string;
};

export function DecksClient() {
  const [list, setList] = useState<DeckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setList(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteDeck = async (id: string, commanderName: string) => {
    if (!confirm(`Delete deck “${commanderName}”? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/decks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setList((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <p className="mt-4 text-zinc-500">Loading…</p>;
  }
  if (list.length === 0) {
    return (
      <p className="mt-4 text-zinc-500">
        No decks yet. Build one from{" "}
        <Link href="/build" className="underline">Build</Link>.
      </p>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {list.map((d) => (
        <li
          key={d.id}
          className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Link
            href={`/decks/${d.id}`}
            className="min-w-0 flex-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="font-medium">{d.commanderName}</span>
            {!d.legalityEnforced && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                (casual)
              </span>
            )}
            <span className="ml-2 text-sm text-zinc-500">
              — {new Date(d.updatedAt).toLocaleDateString()}
            </span>
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleDeleteDeck(d.id, d.commanderName);
            }}
            disabled={deletingId === d.id}
            className="shrink-0 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
            aria-label={`Delete ${d.commanderName} deck`}
          >
            {deletingId === d.id ? "Deleting…" : "Delete"}
          </button>
        </li>
      ))}
    </ul>
  );
}
