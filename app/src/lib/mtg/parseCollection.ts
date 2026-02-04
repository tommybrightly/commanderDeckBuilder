import type { OwnedCard } from "./types";

/** Matches "3 Lightning Bolt", "1 Sol Ring (C14)", "1 Back for More (OTP) 36" (ManaBox: qty name (SET) collector#). */
const LINE_REG = /^\s*(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s*\d*)?\s*$/i;

/** Strip ManaBox-style trailing " (SET) collector_number" or " (SET)" so we get just the card name. */
function stripSetAndCollectorNumber(s: string): string {
  return s.replace(/\s*\([A-Z0-9]+\)\s*\d*\s*$/i, "").trim();
}

/**
 * Parse a pasted list of lines like "3 Lightning Bolt", "1 Sol Ring (C14)", or ManaBox "Back for More (OTP) 36".
 * Normalizes names (strips trailing set/collector#) and coalesces duplicates.
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
      const name = stripSetAndCollectorNumber(namePart);
      if (!name) continue;
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

    // No leading number: treat as 1x card name (e.g. "Back for More (OTP) 36")
    const name = stripSetAndCollectorNumber(trimmed);
    if (!name) continue;
    const setMatch = trimmed.match(/\s*\(([A-Z0-9]+)\)\s*\d*\s*$/i);
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

/** Strip UTF-8 BOM so header detection and parsing work. */
function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Normalize cell for header matching: trim, strip BOM, collapse Unicode spaces. */
function normCell(c: string): string {
  return (c ?? "")
    .replace(/\ufeff/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True if the cell looks like a header (name, quantity, set, etc.). */
function looksLikeHeaderCell(c: string): boolean {
  const n = normCell(c);
  return (
    n === "name" ||
    n === "card" ||
    /^(count|quantity|qty)$/.test(n) ||
    n === "set" ||
    n === "set code" ||
    n.startsWith("set ") ||
    /^(number|collector|collectornumber|collector number)$/.test(n) ||
    n === "foil" ||
    n === "rarity"
  );
}

/**
 * Parse CSV with columns Count, Name, Set, CollectorNumber (or similar).
 * Header is optional; if present, column names are case-insensitive.
 * Supports ManaBox-style: Name, Set code, Set name, Collector number, Quantity, etc.
 * Finds the header row by scanning for a row whose first cell is "name" or "card", or any cell matches known headers.
 */
export function parseCsv(fileContents: string): OwnedCard[] {
  const raw = stripBom(fileContents.trim());
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delim = detectDelimiter(lines[0] ?? "");
  let headerRowIndex = -1;
  let headerCells: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const cells = parseCsvLine(lines[i], delim);
    const first = normCell(cells[0] ?? "");
    if (first === "name" || first === "card") {
      headerRowIndex = i;
      headerCells = cells.map((c) => normCell(c));
      break;
    }
    if (cells.some((c) => looksLikeHeaderCell(c))) {
      headerRowIndex = i;
      headerCells = cells.map((c) => normCell(c));
      break;
    }
  }

  const start = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  let countIdx = -1;
  let nameIdx = 0;
  let setIdx = 1;
  let numIdx = 3;

  if (headerRowIndex >= 0) {
    const idx = (pred: (c: string) => boolean, fallback: number) => {
      const i = headerCells.findIndex(pred);
      return i >= 0 ? i : fallback;
    };
    nameIdx = idx((c) => c === "name" || c === "card", 0);
    countIdx = idx((c) => /^(count|quantity|qty)$/.test(c), -1);
    setIdx = idx((c) => c === "set code" || c === "set" || c.startsWith("set "), 1);
    numIdx = idx((c) => /^(number|collector|collectornumber|collector number)$/.test(c), 3);
  }

  const byName = new Map<string, OwnedCard>();

  for (let i = start; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i], delim);
    const firstCell = normCell(parts[0] ?? "");
    if (firstCell === "name" || firstCell === "card") continue;
    const name = (nameIdx >= 0 && parts[nameIdx] ? parts[nameIdx] : parts[0])?.trim().replace(/^\s+/, "");
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

/** Detect delimiter: if first line has more cells when split by ; and one is "name", use ";". */
function detectDelimiter(firstLine: string): "," | ";" | "\t" {
  const byComma = parseCsvLine(firstLine, ",");
  const bySemicolon = parseCsvLine(firstLine, ";");
  const norm = (c: string) => normCell(c);
  if (bySemicolon.length > 1 && bySemicolon.some((c) => norm(c) === "name" || norm(c) === "card")) {
    return ";";
  }
  if (byComma.length > 1 && byComma.some((c) => norm(c) === "name" || norm(c) === "card")) {
    return ",";
  }
  if (byComma.length > 1) return ",";
  if (bySemicolon.length > 1) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: "," | ";" | "\t" = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === delimiter && !inQuotes) || (c === "\t" && !inQuotes && delimiter !== "\t")) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
