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

  useEffect(() => {
    fetch("/api/decks")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setList(data);
      })
      .finally(() => setLoading(false));
  }, []);

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
        <li key={d.id}>
          <Link
            href={`/decks/${d.id}`}
            className="block rounded border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
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
        </li>
      ))}
    </ul>
  );
}
