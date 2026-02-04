import type { CardInfo, CommanderChoice } from "./types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type CardRow = {
  id: string;
  oracleId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  colors: string;
  colorIdentity: string;
  typeLine: string;
  oracleText: string | null;
  legalities: string | null;
  imageUrl: string | null;
};

function parseJsonArray(s: string): string[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function parseJsonObject(s: string | null): Record<string, string> | undefined {
  if (!s) return undefined;
  try {
    const o = JSON.parse(s);
    return typeof o === "object" && o !== null ? o : undefined;
  } catch {
    return undefined;
  }
}

export function dbCardToCardInfo(row: CardRow): CardInfo {
  const typeLine = row.typeLine ?? "";
  const isLegendary = typeLine.toLowerCase().includes("legendary");
  const types = typeLine.split(/\s+-\s+/)[0]?.split(/\s+/) ?? [];
  return {
    id: row.oracleId,
    name: row.name,
    manaCost: row.manaCost ?? undefined,
    cmc: Number(row.cmc) || 0,
    colors: parseJsonArray(row.colors),
    colorIdentity: parseJsonArray(row.colorIdentity),
    typeLine,
    oracleText: row.oracleText ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    legalities: parseJsonObject(row.legalities),
    isLegendary,
    types,
  };
}

/** Case-insensitive lookup by name. Returns CardInfo or null. */
export async function getCardByNameFromDb(name: string): Promise<CardInfo | null> {
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT * FROM Card WHERE LOWER(TRIM(name)) = LOWER(TRIM(${name})) LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return dbCardToCardInfo(row);
}

/** Batch lookup by names (case-insensitive). Returns map of lowercased name -> CardInfo. */
export async function getCardsByNamesFromDb(names: string[]): Promise<Map<string, CardInfo>> {
  const out = new Map<string, CardInfo>();
  const namesList = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (namesList.length === 0) return out;
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT * FROM Card WHERE LOWER(TRIM(name)) IN (${Prisma.join(
      namesList.map((n) => Prisma.sql`LOWER(TRIM(${n}))`),
      ", "
    )})
  `;
  for (const row of rows) {
    const info = dbCardToCardInfo(row);
    out.set(row.name.toLowerCase(), info);
  }
  return out;
}

/** Search for commanders (legendary creatures or "can be your commander" planeswalkers) by name. */
export async function searchCommandersInDb(query: string): Promise<CommanderChoice[]> {
  const q = query.trim();
  if (!q) return [];
  const namePattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT * FROM Card
    WHERE (
      (LOWER("typeLine") LIKE '%legendary%' AND LOWER("typeLine") LIKE '%creature%')
      OR (LOWER("typeLine") LIKE '%planeswalker%' AND LOWER(COALESCE("oracleText", '')) LIKE '%can be your commander%')
    )
    AND LOWER(name) LIKE LOWER(${namePattern})
    ORDER BY name
    LIMIT 20
  `;
  return rows.map((r) => ({
    id: r.oracleId,
    name: r.name,
    colorIdentity: parseJsonArray(r.colorIdentity),
    imageUrl: r.imageUrl ?? undefined,
    typeLine: r.typeLine,
  }));
}

/** Upsert a card from Scryfall (e.g. after fetching via API). Uses oracleId (CardInfo.id) as unique key. */
export async function upsertCardFromScryfall(info: CardInfo): Promise<void> {
  await prisma.card.upsert({
    where: { oracleId: info.id },
    create: {
      oracleId: info.id,
      name: info.name,
      manaCost: info.manaCost ?? null,
      cmc: info.cmc ?? 0,
      colors: JSON.stringify(info.colors ?? []),
      colorIdentity: JSON.stringify(info.colorIdentity ?? []),
      typeLine: info.typeLine ?? "",
      oracleText: info.oracleText ?? null,
      legalities: info.legalities ? JSON.stringify(info.legalities) : null,
      imageUrl: info.imageUrl ?? null,
    },
    update: {
      name: info.name,
      manaCost: info.manaCost ?? null,
      cmc: info.cmc ?? 0,
      colors: JSON.stringify(info.colors ?? []),
      colorIdentity: JSON.stringify(info.colorIdentity ?? []),
      typeLine: info.typeLine ?? "",
      oracleText: info.oracleText ?? null,
      legalities: info.legalities ? JSON.stringify(info.legalities) : null,
      imageUrl: info.imageUrl ?? null,
    },
  });
}
