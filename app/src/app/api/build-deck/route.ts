import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDeck } from "@/lib/mtg/deckBuilderEngine";
import { parseTextList, parseCsv } from "@/lib/mtg/parseCollection";
import { enrichCollection } from "@/lib/mtg/enrichCollection";
import { dbCardToCardInfo, getCardsByNamesFromDb, getCardByNameFromDb } from "@/lib/mtg/cardDb";
import type { CommanderChoice } from "@/lib/mtg/types";
import type { CardInfo } from "@/lib/mtg/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ type: "error", error: "Unauthorized" }) + "\n", {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  const body = await req.json();
  const {
    collectionId,
    rawInput,
    inputFormat,
    commander,
    enforceLegality,
  } = body as {
    collectionId?: string;
    rawInput?: string;
    inputFormat?: "text" | "csv";
    commander: CommanderChoice;
    enforceLegality?: boolean;
  };

  if (!commander?.name) {
    return new Response(
      JSON.stringify({ type: "error", error: "Missing commander" }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const format = inputFormat ?? "text";
  let owned: Array<{ name: string; quantity: number; setCode?: string; collectorNumber?: string }>;
  let usedCollectionId: string | null = null;
  let collection: { id: string; rawInput: string } | null = null;

  if (collectionId) {
    const coll = await prisma.collection.findFirst({
      where: { id: collectionId, userId: session.user.id },
    });
    if (!coll) {
      return new Response(
        JSON.stringify({ type: "error", error: "Collection not found" }) + "\n",
        { status: 404, headers: { "Content-Type": "application/x-ndjson" } }
      );
    }
    collection = coll;
    usedCollectionId = coll.id;
    owned =
      format === "csv"
        ? parseCsv(coll.rawInput)
        : parseTextList(coll.rawInput);
  } else if (typeof rawInput === "string") {
    owned = format === "csv" ? parseCsv(rawInput) : parseTextList(rawInput);
  } else {
    return new Response(
      JSON.stringify({ type: "error", error: "Provide collectionId or rawInput" }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        let cardInfos: Map<string, CardInfo> | undefined;

        if (collectionId && collection) {
          const itemCount = await prisma.collectionItem.count({
            where: { collectionId },
          });
          if (itemCount === 0) {
            send({ type: "progress", stage: "enriching", progress: 0, message: "Indexing collection…" });
            await enrichCollection(
              collectionId,
              collection.rawInput,
              format,
              (done, total, message) => {
                send({
                  type: "progress",
                  stage: "enriching",
                  progress: total > 0 ? done / total : 0,
                  message,
                });
              }
            );
            send({ type: "progress", stage: "enriching", progress: 1, message: "Indexed" });
          }

          const items = await prisma.collectionItem.findMany({
            where: { collectionId },
            include: { card: true },
          });
          if (items.length === 0) {
            send({
              type: "error",
              error:
                "No cards in this collection. Sync the card database from Settings, then build again.",
            });
            controller.close();
            return;
          }
          owned = items.map((i) => ({ name: i.card.name, quantity: i.quantity }));
          cardInfos = new Map(
            items.map((i) => [
              i.card.name.toLowerCase(),
              dbCardToCardInfo(i.card as Parameters<typeof dbCardToCardInfo>[0]),
            ])
          );
        } else if (typeof rawInput === "string" && owned.length > 0) {
          const uniqueNames = [...new Set(owned.map((c) => c.name.trim()).filter(Boolean))];
          const fromDb = await getCardsByNamesFromDb(uniqueNames);
          const missing = uniqueNames.filter((n) => !fromDb.has(n.toLowerCase()));
          if (missing.length > 0) {
            const list = missing.length <= 5 ? missing.join(", ") : `${missing.slice(0, 5).join(", ")} and ${missing.length - 5} more`;
            send({
              type: "error",
              error: `Cards not in database: ${list}. Sync the card database from Settings first.`,
            });
            controller.close();
            return;
          }
          cardInfos = fromDb;
        }

        const deckList = await buildDeck({
          owned,
          commander,
          options: { enforceLegality: enforceLegality ?? true },
          onProgress: (stage, progress, message) => {
            send({ type: "progress", stage, progress, message });
          },
          cardInfos,
        });
        const deck = await prisma.deck.create({
          data: {
            userId: session.user.id!,
            collectionId: usedCollectionId,
            commanderName: commander.name,
            legalityEnforced: deckList.legalityEnforced,
            data: JSON.parse(JSON.stringify(deckList)),
          },
        });
        send({ type: "result", deckId: deck.id, deck: deckList });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Build failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
