import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichCollection } from "@/lib/mtg/enrichCollection";
import { ensureCardDatabaseSynced } from "@/lib/mtg/syncCardDatabase";
import { detectInputFormat } from "@/lib/mtg/parseCollection";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true, rawInput: true },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(collection);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const { rawInput, inputFormat } = body as {
    rawInput?: string;
    inputFormat?: "text" | "csv";
  };
  if (typeof rawInput !== "string") {
    return NextResponse.json(
      { error: "Missing rawInput" },
      { status: 400 }
    );
  }
  await prisma.collection.update({
    where: { id },
    data: { rawInput: rawInput.trim(), updatedAt: new Date() },
  });
  await ensureCardDatabaseSynced();
  const format = inputFormat ?? detectInputFormat(rawInput);
  const enrichResult = await enrichCollection(id, rawInput.trim(), format);
  const updated = await prisma.collection.findFirst({
    where: { id },
    select: { id: true, name: true, rawInput: true, updatedAt: true },
  });
  return NextResponse.json({
    ...updated,
    skippedCards: enrichResult.skippedCards,
    resolvedCount: enrichResult.resolved,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.collection.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
