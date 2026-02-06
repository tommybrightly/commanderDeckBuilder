"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

const CONFIRM_TEXT = "DELETE";

export function DeleteAccountClient() {
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirm !== CONFIRM_TEXT) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to delete account");
      }
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="card mt-6 border-red-200 bg-red-50/50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="text-lg font-medium text-red-800 dark:text-red-200">
        Delete account
      </h2>
      <p className="mt-1 text-sm text-red-700 dark:text-red-300">
        Permanently delete your account and all your collections and decks. This cannot be undone.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">
            Type <strong className="text-[var(--foreground)]">{CONFIRM_TEXT}</strong> to confirm
          </span>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_TEXT}
            className="max-w-xs rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 font-mono text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
            disabled={deleting}
          />
        </label>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting || confirm !== CONFIRM_TEXT}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
        >
          {deleting ? "Deleting…" : "Delete my account"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
