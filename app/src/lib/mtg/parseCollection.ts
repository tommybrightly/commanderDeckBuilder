import type { OwnedCard } from "./types";

const LINE_REG = /^\s*(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\))?\s*$/i;

/**
 * Parse a pasted list of lines like "3 Lightning Bolt" or "1 Sol Ring (C14)".
 * Normalizes names and coalesces duplicates.
 */
export function parseTextList(input: string): OwnedCard[] {
  const byName = new Map<string, OwnedCard>();

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(LINE_REG);
    if (match) {
      const [, qtyStr, namePart, setCode] = match;
      const quantity = Math.max(1, parseInt(qtyStr ?? "1", 10));
      const name = namePart.trim();
      const key = name.toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        existing.quantity += quantity;
        if (setCode && !existing.setCode) existing.setCode = setCode;
      } else {
        byName.set(key, {
          name,
          quantity,
          setCode: setCode ?? undefined,
        });
      }
      continue;
    }

    // No leading number: treat as 1x card name
    const name = trimmed.replace(/\s*\(\s*[A-Z0-9]+\s*\)\s*$/, "").trim();
    const setMatch = trimmed.match(/\s*\(\s*([A-Z0-9]+)\s*\)\s*$/);
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.quantity += 1;
      if (setMatch && !existing.setCode) existing.setCode = setMatch[1];
    } else {
      byName.set(key, {
        name,
        quantity: 1,
        setCode: setMatch?.[1],
      });
    }
  }

  return Array.from(byName.values());
}

/**
 * Parse CSV with columns Count, Name, Set, CollectorNumber (or similar).
 * Header is optional; if present, column names are case-insensitive.
 */
export function parseCsv(fileContents: string): OwnedCard[] {
  const lines = fileContents.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLine = lines[0].toLowerCase();
  const isHeader = /^(count|quantity|qty|name|card|set|number|collector)/i.test(firstLine.split(",")[0] ?? "");
  const start = isHeader ? 1 : 0;

  let countIdx = 0;
  let nameIdx = 1;
  let setIdx = 2;
  let numIdx = 3;
  if (isHeader) {
    const cols = lines[0].split(",").map((c) => c.trim().toLowerCase());
    countIdx = cols.findIndex((c) => /^(count|quantity|qty)$/.test(c)) ?? 0;
    nameIdx = cols.findIndex((c) => /^(name|card)$/.test(c)) ?? 1;
    setIdx = cols.findIndex((c) => c === "set") ?? 2;
    numIdx = cols.findIndex((c) => /^(number|collector|collectornumber)$/.test(c)) ?? 3;
  }

  const byName = new Map<string, OwnedCard>();

  for (let i = start; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const name = nameIdx >= 0 && parts[nameIdx] ? parts[nameIdx].trim() : parts[0]?.trim();
    if (!name) continue;

    const qtyStr = countIdx >= 0 && parts[countIdx] ? parts[countIdx] : "1";
    const quantity = Math.max(1, parseInt(qtyStr, 10) || 1);
    const setCode = setIdx >= 0 ? parts[setIdx]?.trim() : undefined;
    const collectorNumber = numIdx >= 0 ? parts[numIdx]?.trim() : undefined;

    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      existing.quantity += quantity;
      if (setCode && !existing.setCode) existing.setCode = setCode;
      if (collectorNumber && !existing.collectorNumber) existing.collectorNumber = collectorNumber;
    } else {
      byName.set(key, {
        name,
        quantity,
        setCode,
        collectorNumber,
      });
    }
  }

  return Array.from(byName.values());
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
