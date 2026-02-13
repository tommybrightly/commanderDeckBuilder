import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { enrichCollection } from "@/lib/mtg/enrichCollection";
import { ensureCardDatabaseSynced } from "@/lib/mtg/syncCardDatabase";
import { detectInputFormat } from "@/lib/mtg/parseCollection";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const list = await prisma.collection.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { name, rawInput, inputFormat } = body as {
    name?: string;
    rawInput?: string;
    inputFormat?: "text" | "csv";
  };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Missing name" },
      { status: 400 }
    );
  }
  if (typeof rawInput !== "string") {
    return NextResponse.json(
      { error: "Missing rawInput" },
      { status: 400 }
    );
  }
  const collection = await prisma.collection.create({
    data: {
      userId: session.user.id,
      name: name.trim().slice(0, 200),
      rawInput: rawInput.trim(),
    },
  });
  await ensureCardDatabaseSynced();
  const format = inputFormat ?? detectInputFormat(rawInput);
  const enrichResult = await enrichCollection(collection.id, rawInput.trim(), format);
  return NextResponse.json({
    id: collection.id,
    name: collection.name,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    skippedCards: enrichResult.skippedCards,
    resolvedCount: enrichResult.resolved,
  });
}
