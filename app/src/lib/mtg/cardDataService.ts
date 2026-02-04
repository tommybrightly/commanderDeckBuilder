import type { CardInfo, CommanderChoice } from "./types";

const SCRYFALL = "https://api.scryfall.com";
const cache = new Map<string, CardInfo>();
const CACHE_MAX = 2000;

function scryfallToCardInfo(c: {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  colors: string[];
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  image_uris?: { normal?: string };
  card_faces?: Array<{ image_uris?: { normal?: string } }>;
  legalities?: Record<string, string>;
  supertype?: string;
  types?: string[];
}): CardInfo {
  const typeLine = c.type_line ?? "";
  const isLegendary = typeLine.toLowerCase().includes("legendary");
  const imageUrl =
    c.image_uris?.normal ??
    c.card_faces?.[0]?.image_uris?.normal;
  return {
    id: c.id,
    name: c.name,
    manaCost: c.mana_cost,
    cmc: c.cmc ?? 0,
    colors: c.colors ?? [],
    colorIdentity: c.color_identity ?? [],
    typeLine,
    oracleText: c.oracle_text,
    imageUrl,
    legalities: c.legalities,
    isLegendary,
    types: c.types ?? typeLine.split(/\s+-\s+/)[0]?.split(/\s+/) ?? [],
  };
}

export async function fetchCardByName(name: string): Promise<CardInfo | null> {
  const key = name.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${SCRYFALL}/cards/named?exact=${encodeURIComponent(name)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const card = scryfallToCardInfo(data as Parameters<typeof scryfallToCardInfo>[0]);
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, card);
    return card;
  } catch {
    return null;
  }
}

export async function fetchCardByScryfallId(id: string): Promise<CardInfo | null> {
  const key = `id:${id}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(`${SCRYFALL}/cards/${id}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const card = scryfallToCardInfo(data as Parameters<typeof scryfallToCardInfo>[0]);
    if (cache.size >= CACHE_MAX) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, card);
    cache.set(card.name.toLowerCase(), card);
    return card;
  } catch {
    return null;
  }
}

/**
 * Search for commanders (legendary creatures or "can be your commander" planeswalkers).
 */
export async function searchCommanders(query: string): Promise<CommanderChoice[]> {
  if (!query.trim()) return [];
  try {
    const q = `((t:legendary t:creature) OR (t:planeswalker o:"can be your commander")) ${query.trim()}`;
    const res = await fetch(
      `${SCRYFALL}/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=name`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<Record<string, unknown>> };
    const list = data.data ?? [];
    return list.slice(0, 20).map((c) => ({
      id: (c.id as string) ?? "",
      name: (c.name as string) ?? "",
      colorIdentity: (c.color_identity as string[]) ?? [],
      imageUrl: (c.image_uris as { normal?: string })?.normal ?? (c.card_faces as Array<{ image_uris?: { normal?: string } }>)?.[0]?.image_uris?.normal,
      typeLine: (c.type_line as string) ?? "",
    }));
  } catch {
    return [];
  }
}

export async function getCardInfoList(names: string[]): Promise<Map<string, CardInfo>> {
  const out = new Map<string, CardInfo>();
  const toFetch = names.filter((n) => !cache.has(n.toLowerCase().trim()));
  for (const name of toFetch) {
    const card = await fetchCardByName(name);
    if (card) out.set(card.name.toLowerCase(), card);
  }
  for (const name of names) {
    const c = cache.get(name.toLowerCase().trim()) ?? out.get(name.toLowerCase());
    if (c) out.set(c.name.toLowerCase(), c);
  }
  return out;
}
