import { NextResponse } from "next/server";
import { searchCommanders } from "@/lib/mtg/cardDataService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const results = await searchCommanders(q);
  return NextResponse.json(results);
}
