import { NextResponse } from "next/server";
import { searchCommandersInDb } from "@/lib/mtg/cardDb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchCommandersInDb(q);
  return NextResponse.json(results);
}
