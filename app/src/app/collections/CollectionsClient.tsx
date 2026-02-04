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
      <section>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Add a collection
        </h2>
        <div className="mt-2 flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection name"
            className="max-w-xs rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`rounded px-3 py-1.5 text-sm ${activeTab === "paste" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              Paste list
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("csv")}
              className={`rounded px-3 py-1.5 text-sm ${activeTab === "csv" ? "bg-zinc-200 dark:bg-zinc-700" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              Upload CSV
            </button>
            {activeTab === "csv" && (
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="text-sm"
              />
            )}
          </div>
          {activeTab === "paste" && (
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="3 Lightning Bolt&#10;1 Sol Ring (C14)"
              rows={8}
              className="rounded border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="max-w-xs rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save collection"}
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Saved collections
        </h2>
        {loading ? (
          <p className="text-zinc-500">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-zinc-500">No collections yet. Add one above.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <Link
                  href={`/build?collectionId=${c.id}`}
                  className="min-w-0 flex-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-2 text-sm text-zinc-500">
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
