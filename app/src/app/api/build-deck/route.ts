import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDeck } from "@/lib/mtg/deckBuilderEngine";
import { parseTextList, parseCsv } from "@/lib/mtg/parseCollection";
import type { CommanderChoice } from "@/lib/mtg/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Missing commander" },
      { status: 400 }
    );
  }

  let owned: Array<{ name: string; quantity: number; setCode?: string; collectorNumber?: string }>;
  let usedCollectionId: string | null = null;

  if (collectionId) {
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId: session.user.id },
    });
    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }
    const format = inputFormat ?? "text";
    owned =
      format === "csv"
        ? parseCsv(collection.rawInput)
        : parseTextList(collection.rawInput);
    usedCollectionId = collection.id;
  } else if (typeof rawInput === "string") {
    const format = inputFormat ?? "text";
    owned =
      format === "csv" ? parseCsv(rawInput) : parseTextList(rawInput);
  } else {
    return NextResponse.json(
      { error: "Provide collectionId or rawInput" },
      { status: 400 }
    );
  }

  let deckList;
  try {
    deckList = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: enforceLegality ?? true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const deck = await prisma.deck.create({
    data: {
      userId: session.user.id,
      collectionId: usedCollectionId,
      commanderName: commander.name,
      legalityEnforced: deckList.legalityEnforced,
      data: JSON.parse(JSON.stringify(deckList)),
    },
  });

  return NextResponse.json({ deckId: deck.id, deck: deckList });
}
