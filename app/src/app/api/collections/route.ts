import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, rawInput } = body as { name?: string; rawInput?: string };
  if (!name || typeof rawInput !== "string") {
    return NextResponse.json(
      { error: "Missing name or rawInput" },
      { status: 400 }
    );
  }
  const collection = await prisma.collection.create({
    data: {
      userId: session.user.id,
      name: name.slice(0, 200),
      rawInput,
    },
  });
  return NextResponse.json(collection);
}
