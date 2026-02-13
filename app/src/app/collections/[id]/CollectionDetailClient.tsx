"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { detectInputFormat } from "@/lib/mtg/parseCollection";

const PREVIEW_W = 244;
const PREVIEW_H = 340;

function CardHoverPreview({
  name,
  imageUrl,
  left,
  top,
  onClose,
  onCancelClose,
}: {
  name: string;
  imageUrl: string;
  left: number;
  top: number;
  onClose: () => void;
  onCancelClose?: () => void;
}) {
  return (
    <div
      className="fixed z-50 rounded-lg border-2 border-[var(--card-border)] bg-[var(--card)] p-3 shadow-2xl pointer-events-auto"
      style={{ left, top }}
      onMouseEnter={onCancelClose}
      onMouseLeave={onClose}
      role="tooltip"
      aria-label={`Preview: ${name}`}
    >
      <img
        src={imageUrl}
        alt={name}
        className="block rounded shadow-lg"
        style={{ width: PREVIEW_W, height: PREVIEW_H, objectFit: "cover" }}
      />
      <p className="mt-2 max-w-[280px] truncate text-center text-sm font-medium text-[var(--foreground)]">
        {name}
      </p>
    </div>
  );
}

type CardRow = { name: string; quantity: number; imageUrl?: string };

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
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [preview, setPreview] = useState<{ name: string; imageUrl: string; x: number; y: number } | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPreview = useCallback((name: string, imageUrl: string, x: number, y: number) => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setPreview({ name, imageUrl, x, y });
  }, []);
  const hidePreview = useCallback((delay = 0) => {
    if (delay) {
      hideTimeoutRef.current = setTimeout(() => setPreview(null), delay);
    } else {
      setPreview(null);
    }
  }, []);

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
  const searchLower = search.trim().toLowerCase();
  const filteredCards = (searchLower
    ? cards.filter((c) => c.name.toLowerCase().includes(searchLower))
    : [...cards]
  ).sort((a, b) => a.name.localeCompare(b.name));

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
        {cards.length > 0 && (
          <div className="mt-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              aria-label="Search cards in collection"
            />
            {search.trim() && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {filteredCards.length} of {cards.length} card{cards.length === 1 ? "" : "s"} match
              </p>
            )}
          </div>
        )}
        {cards.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No cards resolved yet. Edit your bulk above and save, or sync the card database from Settings.
          </p>
        ) : filteredCards.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No cards match &quot;{search.trim()}&quot;
          </p>
        ) : (
          <ul className="mt-4 max-h-[28rem] overflow-auto space-y-1.5 rounded bg-[var(--background)]/80 p-3">
            {filteredCards.map((c) => (
                <li key={c.name} className="flex items-center gap-3 py-1.5 text-sm">
                  {c.imageUrl ? (
                    <span
                      className="relative inline-block cursor-pointer shrink-0"
                      onMouseEnter={(e) => showPreview(c.name, c.imageUrl!, e.clientX, e.clientY)}
                      onMouseMove={(e) => setPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : null))}
                      onMouseLeave={() => hidePreview(200)}
                    >
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-16 w-[44px] rounded object-cover shadow-md border border-[var(--card-border)]"
                        loading="lazy"
                        title={c.name}
                      />
                    </span>
                  ) : (
                    <span className="h-16 w-[44px] shrink-0 rounded bg-[var(--card-border)]" aria-hidden />
                  )}
                  <span className="text-[var(--foreground)]">
                    <span className="w-8 shrink-0 text-[var(--muted)]">{c.quantity}×</span> {c.name}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {preview && (
        <CardHoverPreview
          name={preview.name}
          imageUrl={preview.imageUrl}
          left={preview.x}
          top={preview.y}
          onClose={() => hidePreview(0)}
          onCancelClose={() => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          }}
        />
      )}
    </div>
  );
}
