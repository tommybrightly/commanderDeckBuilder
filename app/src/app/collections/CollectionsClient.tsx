"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { detectInputFormat, mergeOwnedCards, parseCsv, parseTextList, serializeToText } from "@/lib/mtg/parseCollection";

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
  const [readingFiles, setReadingFiles] = useState(false);
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [skippedCards, setSkippedCards] = useState<string[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

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

  const handleCancelUpload = () => {
    const xhr = xhrRef.current;
    if (xhr) {
      xhr.abort();
      xhrRef.current = null;
    }
    abortRef.current?.abort();
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
    setUploadProgress(0);
    setUploadMessage("Uploading…");
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 0));
    if (signal.aborted) {
      setSaving(false);
      return;
    }

    let body: string;
    try {
      body = await new Promise<string>((resolve, reject) => {
      const worker = new Worker("/json-stringify-worker.js");
      worker.onmessage = (e) => {
        worker.terminate();
        if (typeof e.data === "string") resolve(e.data);
        else reject(new Error((e.data as { error?: string }).error ?? "Stringify failed"));
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error("Worker failed"));
      };
      signal?.addEventListener("abort", () => {
        worker.postMessage("abort");
        worker.terminate();
        reject(new DOMException("Aborted", "AbortError"));
      });
      if (signal?.aborted) {
        worker.terminate();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      worker.postMessage({
        name: trimName,
        rawInput: rawInput.trim(),
        inputFormat: activeTab,
      });
    });
    } catch (bodyErr) {
      if (bodyErr instanceof DOMException && bodyErr.name === "AbortError") {
        setUploadMessage("Cancelled");
      } else {
        setError(bodyErr instanceof Error ? bodyErr.message : "Failed to prepare");
      }
      setSaving(false);
      return;
    }

    if (signal.aborted) {
      setSaving(false);
      return;
    }

    try {
      const result = await new Promise<{
        id?: string;
        name?: string;
        createdAt?: string;
        updatedAt?: string;
        skippedCards?: string[];
        resolvedCount?: number;
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.withCredentials = true;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => xhr.abort());
        let lastProgressTime = 0;
        xhr.upload.addEventListener("progress", (e) => {
          if (signal?.aborted) return;
          const now = Date.now();
          const isComplete = e.lengthComputable && e.loaded >= e.total;
          if (!isComplete && now - lastProgressTime < 100) return;
          lastProgressTime = now;
          if (e.lengthComputable && e.total > 0) {
            setUploadProgress(e.loaded / e.total);
            setUploadMessage(`Uploading… ${Math.round((100 * e.loaded) / e.total)}%`);
          } else if (e.loaded > 0) {
            setUploadMessage(`Uploading… ${(e.loaded / 1024).toFixed(0)} KB sent`);
          }
        });
        xhr.addEventListener("load", () => {
          xhrRef.current = null;
          try {
            const data = JSON.parse(xhr.responseText || "{}") as typeof result;
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              resolve({ error: (data as { error?: string }).error ?? `Failed (${xhr.status})` });
            }
          } catch {
            resolve({ error: `Invalid response (${xhr.status})` });
          }
        });
        xhr.addEventListener("error", () => {
          xhrRef.current = null;
          reject(new Error("Network error"));
        });
        xhr.addEventListener("abort", () => {
          xhrRef.current = null;
          reject(new DOMException("Aborted", "AbortError"));
        });
        xhr.addEventListener("timeout", () => {
          xhrRef.current = null;
          reject(new Error("Request timed out"));
        });
        xhr.open("POST", "/api/collections");
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.timeout = 300_000;
        xhr.send(body);
      });

      if (result.error) throw new Error(result.error);
      if (!result.id) throw new Error("No result from server");
      setUploadProgress(1);
      setUploadMessage("Done");
      setList((prev) => [
        {
          id: result.id,
          name: result.name ?? trimName,
          createdAt: result.createdAt ?? new Date().toISOString(),
          updatedAt: result.updatedAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setName("");
      setRawInput("");
      setFileCount(null);
      const skipped = result.skippedCards;
      setSkippedCards(skipped ?? null);
      if (result.resolvedCount === 0 && skipped?.length) {
        setError("No cards were recognized. Use exact English names (e.g. Shock, Sol Ring). Non-English names aren't supported.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setUploadMessage("Cancelled");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setSaving(false);
      setUploadProgress(0);
      setUploadMessage("");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setReadingFiles(true);
    setFileCount(files.length);
    try {
      const readFile = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
      const contents = await Promise.all(Array.from(files).map(readFile));
      const parsed = contents.map((text) => {
        const format = detectInputFormat(text);
        return format === "csv" ? parseCsv(text) : parseTextList(text);
      });
      const merged = mergeOwnedCards(parsed);
      setRawInput(serializeToText(merged));
      setActiveTab("text");
    } finally {
      setReadingFiles(false);
      e.target.value = "";
    }
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
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition ${activeTab === "csv" ? "bg-[var(--accent)] text-white" : "btn-secondary"} ${readingFiles ? "pointer-events-none opacity-70" : ""}`}
            >
              Upload CSV (one or more)
              <input
                type="file"
                accept=".csv,.txt"
                multiple
                onChange={(e) => handleFile(e)}
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
          {(readingFiles || saving) && (
            <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4">
              <h3 className="text-sm font-medium text-[var(--foreground)]">
                {readingFiles ? "Reading files…" : "Upload manager"}
              </h3>
              {readingFiles && fileCount != null && (
                <p className="mt-1 text-sm text-[var(--muted)]">Reading {fileCount} file{fileCount === 1 ? "" : "s"}…</p>
              )}
              {saving && (
                <>
                  <p className="mt-2 text-sm text-[var(--foreground)]">{uploadMessage}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]/30">
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCancelUpload();
                    }}
                    onClick={handleCancelUpload}
                    className="mt-3 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
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
