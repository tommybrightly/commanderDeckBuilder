import type { OwnedCard } from "./types";
import { parseTextList, parseCsv } from "./parseCollection";
import { getCardsByNamesFromDb } from "./cardDb";
import { prisma } from "@/lib/prisma";

export type EnrichProgress = (done: number, total: number, message?: string) => void;

/**
 * Parse rawInput to OwnedCard[], resolve each to a Card in DB only,
 * then upsert CollectionItem rows. The card DB is synced automatically when needed (e.g. when building).
 */
export async function enrichCollection(
  collectionId: string,
  rawInput: string,
  inputFormat: "text" | "csv",
  onProgress?: EnrichProgress
): Promise<{ totalCards: number; resolved: number }> {
  const owned =
    inputFormat === "csv" ? parseCsv(rawInput) : parseTextList(rawInput);
  const uniqueNames = [...new Set(owned.map((c) => c.name.trim()).filter(Boolean))];
  const totalCards = owned.reduce((s, c) => s + c.quantity, 0);

  onProgress?.(0, uniqueNames.length, "Resolving cards from database…");
  const allCards = await getCardsByNamesFromDb(uniqueNames);
  const missing = uniqueNames.filter((n) => !allCards.has(n.toLowerCase()));

  if (missing.length > 0) {
    const list = missing.length <= 5 ? missing.join(", ") : `${missing.slice(0, 5).join(", ")} and ${missing.length - 5} more`;
    throw new Error(
      `Some cards weren't found in the card database: ${list}. Sync the card database from Settings first, or check exact card names (e.g. "Sol Ring", "Lightning Bolt").`
    );
  }

  onProgress?.(uniqueNames.length, uniqueNames.length, "Saving collection items…");
  const oracleIds = [...new Set([...allCards.values()].map((c) => c.id))];
  const cardRows =
    oracleIds.length > 0
      ? await prisma.card.findMany({
          where: { oracleId: { in: oracleIds } },
          select: { id: true, oracleId: true },
        })
      : [];
  const oracleToDbId = new Map(cardRows.map((r) => [r.oracleId, r.id]));

  const byCardId = new Map<string, number>();
  for (const o of owned) {
    const key = o.name.trim().toLowerCase();
    const info = allCards.get(key);
    if (!info) continue;
    const cardId = oracleToDbId.get(info.id);
    if (!cardId) continue;
    byCardId.set(cardId, (byCardId.get(cardId) ?? 0) + o.quantity);
  }

  if (byCardId.size === 0) {
    throw new Error(
      "No card names could be resolved. Sync the card database from Settings, then try again. Use exact card names (e.g. 'Sol Ring', 'Lightning Bolt')."
    );
  }

  for (const [cardId, quantity] of byCardId) {
    await prisma.collectionItem.upsert({
      where: {
        collectionId_cardId: { collectionId, cardId },
      },
      create: { collectionId, cardId, quantity },
      update: { quantity },
    });
  }

  return { totalCards, resolved: byCardId.size };
}
