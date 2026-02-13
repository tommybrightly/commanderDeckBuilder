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
): Promise<{ totalCards: number; resolved: number; skippedCards: string[] }> {
  const owned =
    inputFormat === "csv" ? parseCsv(rawInput) : parseTextList(rawInput);
  const uniqueNames = [...new Set(owned.map((c) => c.name.trim()).filter(Boolean))];
  const totalCards = owned.reduce((s, c) => s + c.quantity, 0);

  const totalResolve = uniqueNames.length;
  onProgress?.(0, totalResolve, "Resolving cards from database…");
  const allCards = await getCardsByNamesFromDb(uniqueNames);
  const skippedCards = uniqueNames.filter((n) => !allCards.has(n.toLowerCase()));
  onProgress?.(totalResolve, totalResolve, "Resolved. Preparing to save…");

  await prisma.collectionItem.deleteMany({ where: { collectionId } });
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

  const entries = [...byCardId.entries()];
  const totalSave = entries.length;
  const totalSteps = totalResolve + totalSave;
  for (let i = 0; i < entries.length; i++) {
    const [cardId, quantity] = entries[i]!;
    await prisma.collectionItem.upsert({
      where: {
        collectionId_cardId: { collectionId, cardId },
      },
      create: { collectionId, cardId, quantity },
      update: { quantity },
    });
    const reportInterval = totalSave <= 50 ? 5 : totalSave <= 200 ? 15 : 50;
    if (onProgress && (i % reportInterval === 0 || i === entries.length - 1)) {
      onProgress(totalResolve + i + 1, totalSteps, `Saving ${i + 1}/${totalSave} cards…`);
    }
  }

  return { totalCards, resolved: byCardId.size, skippedCards };
}
