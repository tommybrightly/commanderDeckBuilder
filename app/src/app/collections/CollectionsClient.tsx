"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type CollectionRow = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function CollectionsClient() {
  const [list, setList] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [rawInput, setRawInput] = useState("");
  const [activeTab, setActiveTab] = useState<"paste" | "csv">("paste");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skippedCards, setSkippedCards] = useState<string[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setList(data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDeleteCollection = async (id: string, collectionName: string) => {
    if (!confirm(`Delete collection “${collectionName}”? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setList((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete collection");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    const trimName = name.trim();
    if (!trimName) {
      setError("Give the collection a name.");
      return;
    }
    if (!rawInput.trim()) {
      setError("Paste or upload your card list.");
      return;
    }
    setError(null);
    setSkippedCards(null);
    setSaving(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimName,
          rawInput: rawInput.trim(),
          inputFormat: activeTab,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed to save");
      }
      const created = await res.json();
      setList((prev) => [{ ...created, createdAt: created.createdAt, updatedAt: created.updatedAt }, ...prev]);
      setName("");
      setRawInput("");
      setSkippedCards(created.skippedCards ?? null);
      if (created.resolvedCount === 0 && created.skippedCards?.length) {
        setError("No cards were recognized. Use exact English names (e.g. Shock, Sol Ring). Non-English names aren't supported.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRawInput(String(reader.result ?? ""));
    reader.readAsText(file);
    setActiveTab("csv");
  };

  return (
    <div className="mt-6 space-y-8">
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Add a collection
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection name"
            className="max-w-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === "paste" ? "bg-[var(--accent)] text-white" : "btn-secondary"}`}
            >
              Paste list
            </button>
            <label
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === "csv" ? "bg-[var(--accent)] text-white" : "btn-secondary"}`}
            >
              Upload CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => {
                  handleFile(e);
                  setActiveTab("csv");
                }}
                className="sr-only"
              />
            </label>
          </div>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={activeTab === "csv" ? "Paste CSV or click Upload CSV to choose a file" : "3 Lightning Bolt&#10;1 Sol Ring (C14)"}
            rows={8}
            className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {skippedCards && skippedCards.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                {skippedCards.length} card{skippedCards.length === 1 ? "" : "s"} skipped (not found)
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Use exact English names (e.g. Shock, Sol Ring). Non-English names aren&apos;t supported.
              </p>
              <p className="mt-2 font-mono text-xs text-[var(--foreground)]">
                {skippedCards.length <= 10 ? skippedCards.join(", ") : `${skippedCards.slice(0, 10).join(", ")} and ${skippedCards.length - 10} more`}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary max-w-xs"
          >
            {saving ? "Saving…" : "Save collection"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Saved collections
        </h2>
        {loading ? (
          <p className="mt-2 text-[var(--muted)]">Loading…</p>
        ) : list.length === 0 ? (
          <p className="mt-2 text-[var(--muted)]">No collections yet. Add one above.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {list.map((c) => (
              <li
                key={c.id}
                className="card flex items-center justify-between gap-2 transition hover:border-[var(--accent)]/40"
              >
                <Link
                  href={`/collections/${c.id}`}
                  className="min-w-0 flex-1 px-4 py-3 transition hover:opacity-90"
                >
                  <span className="font-medium text-[var(--foreground)]">{c.name}</span>
                  <span className="ml-2 text-sm text-[var(--muted)]">
                    Updated {new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteCollection(c.id, c.name);
                  }}
                  disabled={deletingId === c.id}
                  className="shrink-0 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
                  aria-label={`Delete ${c.name}`}
                >
                  {deletingId === c.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
