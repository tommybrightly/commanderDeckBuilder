import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCommanderPlanWithCache } from "@/lib/mtg/commanderProfileCache";
import { getProfileTargets } from "@/lib/mtg/profileTargets";
import { rankUpgradeSuggestions } from "@/lib/mtg/upgradeSuggestions";
import { getCardByNameFromDb, dbCardToCardInfo } from "@/lib/mtg/cardDb";
import type { DeckList } from "@/lib/mtg/types";
import type { CardInfo } from "@/lib/mtg/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const limit = Math.min(50, Math.max(5, parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10) || 20));

  const deck = await prisma.deck.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!deck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!deck.collectionId) {
    return NextResponse.json({
      suggestions: [],
      message: "This deck was built from a pasted list; add it from a saved collection to get upgrade suggestions.",
    });
  }

  const collection = await prisma.collection.findFirst({
    where: { id: deck.collectionId, userId: session.user.id },
  });
  if (!collection) {
    return NextResponse.json({ suggestions: [], message: "Collection not found." });
  }

  const items = await prisma.collectionItem.findMany({
    where: { collectionId: deck.collectionId },
    include: { card: true },
  });
  if (items.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const cardInfos = new Map<string, CardInfo>();
  const candidates: CardInfo[] = [];
  for (const i of items) {
    const info = dbCardToCardInfo(i.card as Parameters<typeof dbCardToCardInfo>[0]);
    cardInfos.set(info.name.toLowerCase(), info);
    candidates.push(info);
  }

  const data = deck.data as unknown as DeckList;
  const main = data?.main ?? [];
  const commanderInfo = await getCardByNameFromDb(deck.commanderName);
  if (!commanderInfo) {
    return NextResponse.json({ suggestions: [], message: "Commander not in database." });
  }

  const plan = await getCommanderPlanWithCache(commanderInfo);
  const profile = getProfileTargets(plan, { enforceLegality: deck.legalityEnforced });
  const roleTargets = {
    ramp: profile.targetRamp,
    draw: profile.targetDraw,
    removal: profile.targetRemoval,
    interaction: profile.targetInteraction,
    sweeper: profile.targetSweeper,
    finisher: profile.targetFinisher,
  };
  const commanderThemes = plan.primaryThemes;

  const suggestions = rankUpgradeSuggestions(
    candidates,
    main,
    plan,
    profile,
    roleTargets,
    commanderThemes,
    cardInfos,
    limit
  );

  return NextResponse.json({ suggestions });
}
