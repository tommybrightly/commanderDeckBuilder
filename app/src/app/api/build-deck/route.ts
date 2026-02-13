import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDeck, buildDeckFromCardNames } from "@/lib/mtg/deckBuilderEngine";
import { getAIDeckList, getStrategyExplanation } from "@/lib/mtg/aiDeckBuilder";
import { parseTextList, parseCsv, detectInputFormat } from "@/lib/mtg/parseCollection";
import { enrichCollection } from "@/lib/mtg/enrichCollection";
import { dbCardToCardInfo, getCardsByNamesFromDb, getCardByNameFromDb } from "@/lib/mtg/cardDb";
import { ensureCardDatabaseSynced } from "@/lib/mtg/syncCardDatabase";
import type { BuilderOptions, CommanderChoice, DeckArchetype, MetaProfile, Playstyle } from "@/lib/mtg/types";
import type { CardInfo } from "@/lib/mtg/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  const {
    collectionId,
    rawInput,
    inputFormat,
    commander,
    enforceLegality,
    archetype,
    meta,
    playstyle,
  } = body as {
    collectionId?: string;
    rawInput?: string;
    inputFormat?: "text" | "csv";
    commander: CommanderChoice;
    enforceLegality?: boolean;
    archetype?: DeckArchetype;
    meta?: MetaProfile;
    playstyle?: Playstyle;
  };

  if (!commander?.name) {
    return new Response(
      JSON.stringify({ type: "error", error: "Missing commander" }) + "\n",
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  let format = inputFormat ?? "text";
  let owned: Array<{ name: string; quantity: number; setCode?: string; collectorNumber?: string }>;
  let usedCollectionId: string | null = null;
  let collection: { id: string; rawInput: string } | null = null;

  if (collectionId) {
    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ type: "error", error: "Sign in to build from a saved collection." }) + "\n",
        { status: 401, headers: { "Content-Type": "application/x-ndjson" } }
      );
    }
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
    if (!inputFormat) format = detectInputFormat(coll.rawInput);
    owned =
      format === "csv"
        ? parseCsv(coll.rawInput)
        : parseTextList(coll.rawInput);
  } else if (typeof rawInput === "string") {
    owned = format === "csv" ? parseCsv(rawInput) : parseTextList(rawInput);
  } else {
    return new Response(
      JSON.stringify({ type: "error", error: "Provide a pasted list or sign in and choose a saved collection." }) + "\n",
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
        await ensureCardDatabaseSynced((message, progress) => {
          send({ type: "progress", stage: "syncing", progress, message });
        });

        let cardInfos: Map<string, CardInfo> | undefined;
        let skippedCards: string[] = [];

        if (collectionId && collection) {
          const itemCount = await prisma.collectionItem.count({
            where: { collectionId },
          });
          if (itemCount === 0) {
            send({ type: "progress", stage: "enriching", progress: 0, message: "Indexing collection…" });
            const enrichResult = await enrichCollection(
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
            skippedCards = enrichResult.skippedCards ?? [];
            send({ type: "progress", stage: "enriching", progress: 1, message: "Indexed" });
          }

          const items = await prisma.collectionItem.findMany({
            where: { collectionId },
            include: { card: true },
          });
          if (items.length === 0) {
            const hint = skippedCards.length > 0
              ? "No cards could be recognized. Use exact English names (e.g. Shock, Sol Ring). Non-English names aren't supported."
              : "No cards in this collection. Sync the card database from Settings, then build again.";
            send({ type: "error", error: hint });
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
          skippedCards = missing;
          const missingSet = new Set(missing.map((n) => n.toLowerCase()));
          owned = owned.filter((o) => !missingSet.has(o.name.trim().toLowerCase()));
          cardInfos = fromDb;
          if (owned.length === 0) {
            send({
              type: "error",
              error: "No cards could be found in the database. Use exact English card names (e.g. Shock, Sol Ring). Non-English names aren't supported.",
            });
            controller.close();
            return;
          }
        }

        const enforceLegalityOption = enforceLegality ?? true;
        const archetypeOption = archetype ?? "balanced";
        const builderOptions: BuilderOptions = {
          enforceLegality: enforceLegalityOption,
          archetype: archetypeOption,
          power: "high_power",
          meta: meta ?? "combat",
          playstyle: playstyle ?? "balanced",
        };
        const commanderInfo = cardInfos?.get(commander.name.toLowerCase()) ?? await getCardByNameFromDb(commander.name);
        if (!commanderInfo) {
          send({
            type: "error",
            error: `Commander not found: ${commander.name}. Sync the card database from Settings.`,
          });
          controller.close();
          return;
        }
        if (!cardInfos) {
          send({
            type: "error",
            error: "No cards in collection or list to build from.",
          });
          controller.close();
          return;
        }

        let deckList;
        const useAI = Boolean(process.env.OPENAI_API_KEY?.trim());
        if (useAI) {
          send({ type: "progress", stage: "building", progress: 0.2, message: "Using AI to build the best deck…" });
          const collectionNames = owned.map((c) => c.name);
          const aiResult = await getAIDeckList({
            commanderName: commander.name,
            colorIdentity: commander.colorIdentity ?? [],
            collectionCardNames: collectionNames,
          });
          if (aiResult && (aiResult.main.length >= 20 || aiResult.lands.length >= 10)) {
            const fromAI = buildDeckFromCardNames({
              mainNames: aiResult.main,
              landNames: aiResult.lands,
              owned,
              commander,
              cardInfos,
              enforceLegality: enforceLegalityOption,
              commanderInfo,
            });
            if (fromAI) {
              const total = fromAI.main.length + fromAI.lands.length;
              if (total >= 99) {
                deckList = fromAI;
                send({ type: "progress", stage: "building", progress: 1, message: "AI deck ready" });
              } else {
                send({ type: "progress", stage: "building", progress: 0.7, message: "Filling to 99 cards…" });
                deckList = await buildDeck({
                  owned,
                  commander,
                  options: builderOptions,
                  onProgress: (stage, progress, message) => {
                    send({ type: "progress", stage, progress, message });
                  },
                  cardInfos,
                  initialDeck: { main: fromAI.main, lands: fromAI.lands },
                });
              }
            }
          }
        }

        if (!deckList) {
          deckList = await buildDeck({
            owned,
            commander,
            options: builderOptions,
            onProgress: (stage, progress, message) => {
              send({ type: "progress", stage, progress, message });
            },
            cardInfos,
          });
        }
        if (process.env.OPENAI_API_KEY?.trim()) {
          send({ type: "progress", stage: "building", progress: 0.95, message: "Writing strategy…" });
          const strategy = await getStrategyExplanation({
            commanderName: commander.name,
            mainCardNames: deckList.main.map((c) => c.name),
          });
          if (strategy) deckList.stats.strategyExplanation = strategy;
        }
        const deckWithSkipped = skippedCards.length > 0 ? { ...deckList, skippedCards } : deckList;
        if (session?.user?.id) {
          const deck = await prisma.deck.create({
            data: {
              userId: session.user.id,
              collectionId: usedCollectionId,
              commanderName: commander.name,
              legalityEnforced: deckList.legalityEnforced,
              data: JSON.parse(JSON.stringify(deckWithSkipped)),
            },
          });
          send({ type: "result", deckId: deck.id, deck: deckWithSkipped, collectionId: usedCollectionId ?? undefined });
        } else {
          send({ type: "result", deckId: null, deck: deckWithSkipped, collectionId: undefined });
        }
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
