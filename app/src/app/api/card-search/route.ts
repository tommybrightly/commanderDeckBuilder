import { NextResponse } from "next/server";
import { searchCommandersInDb } from "@/lib/mtg/cardDb";
import { ensureCardDatabaseSynced } from "@/lib/mtg/syncCardDatabase";

export const maxDuration = 300;

export async function GET(req: Request) {
  await ensureCardDatabaseSynced();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchCommandersInDb(q);
  return NextResponse.json(results);
}
