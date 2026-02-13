"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { detectInputFormat } from "@/lib/mtg/parseCollection";

type CardRow = { name: string; quantity: number };

export function CollectionDetailClient({
  collectionId,
  collectionName,
  rawInput,
  cards,
  updatedAt,
}: {
  collectionId: string;
  collectionName: string;
  rawInput: string;
  cards: CardRow[];
  updatedAt: Date;
}) {
  const [editing, setEditing] = useState(false);
  const [editRawInput, setEditRawInput] = useState(rawInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedCards, setSkippedCards] = useState<string[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!editing) setEditRawInput(rawInput);
  }, [rawInput, editing]);

  const handleSave = async () => {
    setError(null);
    setSkippedCards(null);
    setSaving(true);
    try {
      const format = detectInputFormat(editRawInput);
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: editRawInput.trim(), inputFormat: format }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed to save");
      }
      const data = await res.json();
      setEditRawInput(data.rawInput);
      setSkippedCards(data.skippedCards ?? null);
      setEditing(false);
      if (data.resolvedCount === 0 && data.skippedCards?.length) {
        setError("No cards were recognized. Use exact English names.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const totalCards = cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {collectionName}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {cards.length} unique card{cards.length === 1 ? "" : "s"} · {totalCards} total
            {" · "}
            Updated {new Date(updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/build?collectionId=${collectionId}`} className="btn-primary">
            Build deck
          </Link>
          <Link href="/collections" className="btn-secondary">
            Back to collections
          </Link>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Your bulk
          </h2>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary text-sm"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditRawInput(rawInput);
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <textarea
            value={editRawInput}
            onChange={(e) => setEditRawInput(e.target.value)}
            placeholder="3 Lightning Bolt&#10;1 Sol Ring (C14)"
            rows={12}
            className="mt-4 w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        ) : (
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4 font-mono text-sm text-[var(--foreground)] whitespace-pre-wrap">
            {rawInput || "No cards in this collection."}
          </pre>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {skippedCards && skippedCards.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {skippedCards.length} card{skippedCards.length === 1 ? "" : "s"} skipped (not found)
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Use exact English names (e.g. Shock, Sol Ring).
            </p>
            <p className="mt-2 font-mono text-xs text-[var(--foreground)]">
              {skippedCards.length <= 10 ? skippedCards.join(", ") : `${skippedCards.slice(0, 10).join(", ")} and ${skippedCards.length - 10} more`}
            </p>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Card list ({cards.length} unique)
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Resolved cards from your bulk. Edit above to add or remove cards.
        </p>
        {cards.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No cards resolved yet. Edit your bulk above and save, or sync the card database from Settings.
          </p>
        ) : (
          <ul className="mt-4 max-h-96 overflow-auto space-y-1 font-mono text-sm">
            {cards
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <li key={c.name} className="flex gap-2 text-[var(--foreground)]">
                  <span className="w-8 shrink-0 text-[var(--muted)]">{c.quantity}×</span>
                  <span>{c.name}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
