import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await prisma.deck.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      commanderName: true,
      legalityEnforced: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(list);
}

/** Save a built deck (e.g. after building without sign-in). Body: { commanderName, data: DeckList, collectionId?, legalityEnforced? }. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to save decks." }, { status: 401 });
  }
  let body: { commanderName: string; data: unknown; collectionId?: string | null; legalityEnforced?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { commanderName, data, collectionId, legalityEnforced = true } = body;
  if (!commanderName || typeof data !== "object" || data == null) {
    return NextResponse.json({ error: "Missing commanderName or deck data." }, { status: 400 });
  }
  const deck = await prisma.deck.create({
    data: {
      userId: session.user.id,
      collectionId: collectionId ?? null,
      commanderName,
      legalityEnforced: Boolean(legalityEnforced),
      data: data as object,
    },
  });
  return NextResponse.json({ id: deck.id });
}
