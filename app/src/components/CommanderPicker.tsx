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
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600"
          >
            Clear
          </button>
        )}
      </div>
      {loading && (
        <p className="mt-1 text-sm text-zinc-500">Searching…</p>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => select(c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
