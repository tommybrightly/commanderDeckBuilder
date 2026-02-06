import OpenAI from "openai";

const MAX_COLLECTION_IN_PROMPT = 500;

/**
 * Ask OpenAI for a 99-card Commander deck (63 nonlands + 36 lands) using only cards from the collection.
 * Returns parsed main and land card names, or null if the request fails or response is unusable.
 */
export async function getAIDeckList(params: {
  commanderName: string;
  colorIdentity: string[];
  collectionCardNames: string[];
}): Promise<{ main: string[]; lands: string[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const { commanderName, colorIdentity, collectionCardNames } = params;
  const uniqueNames = [...new Set(collectionCardNames)].filter(Boolean).slice(0, MAX_COLLECTION_IN_PROMPT);
  const colors = colorIdentity.length ? ` (color identity: ${colorIdentity.join(", ")})` : "";

  const openai = new OpenAI({ apiKey });

  const systemPrompt = `You are an expert Magic: The Gathering Commander (EDH) deck builder. You output only card names, one per line. Use exact spelling and names only from the list provided.`;

  const userPrompt = `Commander: ${commanderName}${colors}

Build a complete 99-card Commander deck using ONLY these cards from the collection (use exact names from this list):
${uniqueNames.join(", ")}

Target structure (aim for the full 99 cards):
- Nonlands (63 total): 10-15 ramp, 10-12 card draw, 10-15 removal, 3-6 board wipes, 25-30 synergy/theme, plus finishers and utility.
- Lands (34-38 total): 34-38 lands. Include duals/utility lands and basics.
- Card type balance (critical): Aim for roughly 22-40 CREATURES (most decks need creatures for board presence and wins). Use 6-12 instants (do not exceed 12 instants). Use 4-8 sorceries, 4-10 enchantments, 5-12 artifacts. Avoid instant-heavy or creature-light builds unless the commander is clearly a spellslinger (e.g. Niv-Mizzet, Kess).
- Curve: Prefer a lower curve with many 2-3 mana plays.

Output exactly 99 card names, one per line. No numbers or bullets. First list all 63 nonland cards, then one blank line, then all lands (34-36). Only use card names that appear in the collection list above.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;

    const rawLines = text.split(/\r?\n/).map((s) => s.replace(/^\s*\d+[.)]\s*/, "").replace(/^\s*[-*•]\s*/, "").trim());
    const blankIndex = rawLines.findIndex((l) => l === "");
    const beforeBlank = blankIndex >= 0 ? rawLines.slice(0, blankIndex) : rawLines;
    const afterBlank = blankIndex >= 0 ? rawLines.slice(blankIndex + 1) : [];
    const allNames = [...beforeBlank, ...afterBlank].filter(Boolean).slice(0, 99);

    if (allNames.length < 20) return null;
    return { main: allNames, lands: [] };
  } catch {
    return null;
  }
}

const VALID_THEME_IDS =
  "spellslinger, tokens, counters, sacrifice, artifacts, enchantments, landfall, graveyard, attack, flying, lifegain, draw, voltron, etb, death, tap_untap, top_of_library, copy, commander_damage";

/**
 * Ask OpenAI for 3-5 theme keywords that describe what the commander's abilities support.
 * Used to improve synergy scoring when pattern-based detection might miss nuances.
 * Returns null if no API key or request fails.
 */
export async function getCommanderThemesFromAI(params: {
  commanderName: string;
  oracleText: string;
}): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const { commanderName, oracleText } = params;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert Magic: The Gathering Commander (EDH) deck builder. Reply with ONLY a comma-separated list of theme IDs. Use only these exact IDs: ${VALID_THEME_IDS}. Pick 3-5 that best describe what this commander's abilities support. No other text.`,
        },
        {
          role: "user",
          content: `Commander: ${commanderName}. Abilities: ${(oracleText || "").slice(0, 800)}. List 3-5 theme IDs from the allowed list, comma-separated.`,
        },
      ],
      max_tokens: 80,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    const ids = text.split(",").map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"));
    const validSet = new Set(VALID_THEME_IDS.split(", ").map((s) => s.trim().toLowerCase().replace(/\s+/g, "_")));
    return ids.filter((id) => validSet.has(id));
  } catch {
    return null;
  }
}

/** Strip "1. ", "- ", etc. from a line for card name lookup. */
export function stripListMarker(line: string): string {
  return line
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^\s*[-*•]\s*/, "")
    .trim();
}

/**
 * Ask OpenAI for a short explanation of how the deck is meant to be played.
 * Returns 2-3 sentences, or null if the request fails or no API key.
 */
export async function getStrategyExplanation(params: {
  commanderName: string;
  mainCardNames: string[];
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const { commanderName, mainCardNames } = params;
  const list = mainCardNames.slice(0, 80).join(", ");
  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert Magic: The Gathering Commander (EDH) player. Write 2-3 clear sentences. No bullet points.",
        },
        {
          role: "user",
          content: `Commander: ${commanderName}. Main deck (nonland) cards: ${list}. In 2-3 sentences, explain how this deck is meant to be played: what is the strategy, how does it win, and what role the commander plays. Keep it concise.`,
        },
      ],
      max_tokens: 256,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    return text ?? null;
  } catch {
    return null;
  }
}
