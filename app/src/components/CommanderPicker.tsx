"use client";

import { useCallback, useRef, useState } from "react";
import type { CommanderChoice } from "@/lib/mtg/types";

const SEARCH_DELAY_MS = 300;

export function CommanderPicker({
  value,
  onChange,
  placeholder = "Search for a commander…",
}: {
  value: CommanderChoice | null;
  onChange: (c: CommanderChoice | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommanderChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/card-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (value) onChange(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => search(v), SEARCH_DELAY_MS);
  };

  const select = (c: CommanderChoice) => {
    onChange(c);
    setQuery(c.name);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {value?.imageUrl && (
          <img
            src={value.imageUrl}
            alt=""
            className="h-10 w-7 rounded object-cover"
          />
        )}
        <input
          type="text"
          value={value ? value.name : query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--card)] px-3 py-2 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="btn-secondary text-sm"
          >
            Clear
          </button>
        )}
      </div>
      {loading && (
        <p className="mt-1 text-sm text-[var(--muted)]">Searching…</p>
      )}
      {open && results.length > 0 && (
        <ul className="card absolute z-10 mt-1 max-h-60 w-full overflow-auto shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => select(c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--foreground)] transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="h-8 w-6 rounded object-cover"
                  />
                )}
                <span className="text-sm font-medium">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
