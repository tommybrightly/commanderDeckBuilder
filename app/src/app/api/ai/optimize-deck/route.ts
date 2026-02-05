import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTextList, parseCsv } from "@/lib/mtg/parseCollection";
import OpenAI from "openai";

const MAX_COLLECTION_LIST = 400;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "OpenAI is not configured. Add OPENAI_API_KEY to your .env to enable AI optimization." },
      { status: 503 }
    );
  }

  let body: {
    commanderName: string;
    colorIdentity?: string[];
    main: string[];
    lands: string[];
    collectionCardNames?: string[];
    collectionId?: string;
    collectionFormat?: "text" | "csv";
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { commanderName, colorIdentity = [], main = [], lands = [], collectionCardNames, collectionId, collectionFormat = "text" } = body;
  if (!commanderName || !Array.isArray(main) || !Array.isArray(lands)) {
    return Response.json({ error: "Missing commanderName, main, or lands" }, { status: 400 });
  }

  let collectionList: string[];
  if (Array.isArray(collectionCardNames) && collectionCardNames.length > 0) {
    collectionList = [...new Set(collectionCardNames)].slice(0, MAX_COLLECTION_LIST);
  } else if (collectionId && session.user.id) {
    const coll = await prisma.collection.findFirst({
      where: { id: collectionId, userId: session.user.id },
    });
    if (!coll) {
      return Response.json({ error: "Collection not found" }, { status: 404 });
    }
    const parsed = collectionFormat === "csv" ? parseCsv(coll.rawInput) : parseTextList(coll.rawInput);
    collectionList = [...new Set(parsed.map((c) => c.name))].slice(0, MAX_COLLECTION_LIST);
  } else {
    collectionList = [...main, ...lands];
  }
  const colors = colorIdentity.length ? ` (colors: ${colorIdentity.join(", ")})` : "";

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert Magic: The Gathering Commander (EDH) deck builder. You give concise, actionable advice. Only suggest cards that appear in the player's collection list. Use exact card names from that list.`;

  const userPrompt = `Commander: ${commanderName}${colors}

Current deck (${main.length} nonlands + ${lands.length} lands):
Main deck: ${main.join(", ")}
Lands: ${lands.join(", ")}

Collection (cards the player owns; only suggest cards from this list):
${collectionList.join(", ")}

Suggest 5–10 cards to CUT from the current deck and 5–10 cards to ADD from the collection. Focus on improving curve, synergy with the commander, and balance of ramp/draw/removal. Format your response like:

CUT:
- CardName — brief reason
ADD:
- CardName — brief reason

Keep each line short. Only use card names that appear in the collection list above.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1024,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return Response.json({ error: "No response from AI" }, { status: 502 });
    }

    return Response.json({ suggestion: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
