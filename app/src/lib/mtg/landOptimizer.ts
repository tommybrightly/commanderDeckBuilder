import type { CardInDeck, CardInfo } from "./types";

/**
 * Phase 4.3: Lands as part of optimization — estimate pip demand from main deck,
 * prioritize fixing and untapped sources.
 */

export type PipCounts = Record<"W" | "U" | "B" | "R" | "G", number>;

const COLOR_CHARS = ["W", "U", "B", "R", "G"] as const;

/**
 * Parse a mana cost string (e.g. "{2}{W}{U}", "{W/U}") into colored pips.
 * Hybrid/phyrexian count as 0.5 per color for demand estimation.
 */
export function parseManaCostPips(manaCost: string | undefined): PipCounts {
  const pips: PipCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  if (!manaCost || typeof manaCost !== "string") return pips;

  // Match {X} where X can be digit, single letter, or W/U style
  const matches = manaCost.matchAll(/\{([^}]+)\}/g);
  for (const m of matches) {
    const sym = m[1]!.toUpperCase();
    if (COLOR_CHARS.includes(sym as (typeof COLOR_CHARS)[number])) {
      pips[sym as keyof PipCounts] = (pips[sym as keyof PipCounts] ?? 0) + 1;
    } else if (sym.includes("/")) {
      // Hybrid or Phyrexian: e.g. W/U, 2/W
      const parts = sym.split("/");
      const inc = 1 / Math.max(1, parts.length);
      for (const p of parts) {
        const c = p.replace(/^[0-9]/, "").trim();
        if (COLOR_CHARS.includes(c as (typeof COLOR_CHARS)[number]))
          pips[c as keyof PipCounts] = (pips[c as keyof PipCounts] ?? 0) + inc;
      }
    }
  }
  return pips;
}

/**
 * Sum colored pip demand across a list of cards (main deck).
 */
export function getPipDemand(
  main: CardInDeck[],
  cardInfos: Map<string, CardInfo>
): PipCounts {
  const demand: PipCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const c of main) {
    const info = cardInfos.get(c.name.toLowerCase());
    if (!info?.manaCost) continue;
    const p = parseManaCostPips(info.manaCost);
    for (const col of COLOR_CHARS)
      demand[col] = (demand[col] ?? 0) + (p[col] ?? 0);
  }
  return demand;
}

/**
 * Heuristic: does this land enter the battlefield tapped? (Oracle text or name patterns.)
 */
export function landEntersTapped(card: CardInfo): boolean {
  const text = (card.oracleText ?? "").toLowerCase();
  const name = (card.name ?? "").toLowerCase();
  if (text.includes("enters the battlefield tapped")) return true;
  if (/\btap(s|ped)\s+unless\b/.test(text)) return false; // "enters tapped unless" → often untapped
  if (name.includes("fetch") && name.includes("land")) return false;
  if (name.includes("triome") || name.includes("pathway") || name.includes("bond")) return false;
  // Duals that always tap: guildgates, gain lands, etc.
  if (name.includes("gate") || name.includes("gain-land") || /comes into play tapped/.test(text))
    return true;
  return false;
}

/**
 * Which colors can this land produce? (T: Add W, T: Add U, etc.)
 * Returns a count per color (1 if can produce, 0 otherwise) for basic color symbols.
 */
export function landProduces(card: CardInfo): PipCounts {
  const out: PipCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const text = (card.oracleText ?? "").toLowerCase();
  if (/add\s+(\{w\}|\{u\}|\{b\}|\{r\}|\{g\})/.test(text) || /add one mana of any type/.test(text)) {
    // "Add {W}", "Add {U}", or any color
    if (/add one mana of any type|any color|mana of any color/.test(text)) {
      out.W = out.U = out.B = out.R = out.G = 1;
      return out;
    }
    if (/\{w\}/.test(text)) out.W = 1;
    if (/\{u\}/.test(text)) out.U = 1;
    if (/\{b\}/.test(text)) out.B = 1;
    if (/\{r\}/.test(text)) out.R = 1;
    if (/\{g\}/.test(text)) out.G = 1;
  }
  // "Tap: Add W or U"
  if (/add\s+(\w)\s+or\s+(\w)/.test(text)) {
    const m = text.match(/add\s+(\w)\s+or\s+(\w)/);
    if (m) {
      const a = m[1]!.toUpperCase();
      const b = m[2]!.toUpperCase();
      if (COLOR_CHARS.includes(a as (typeof COLOR_CHARS)[number])) out[a as keyof PipCounts] = 1;
      if (COLOR_CHARS.includes(b as (typeof COLOR_CHARS)[number])) out[b as keyof PipCounts] = 1;
    }
  }
  return out;
}

/**
 * Score a land for inclusion: higher = better fit.
 * Favors lands that produce needed colors and that enter untapped.
 */
export function landScore(
  land: CardInfo,
  pipDemand: PipCounts,
  alreadyProducing: PipCounts,
  identity: string[]
): number {
  const produces = landProduces(land);
  const tapped = landEntersTapped(land);
  let score = 0;
  for (const c of COLOR_CHARS) {
    if (identity.includes(c) && produces[c] > 0) {
      const need = Math.max(0, (pipDemand[c] ?? 0) - (alreadyProducing[c] ?? 0));
      score += (need > 0 ? 1.5 : 0.5) * produces[c]; // bonus if we still need this color
    }
  }
  if (!tapped) score += 0.8; // prefer untapped
  return score;
}
