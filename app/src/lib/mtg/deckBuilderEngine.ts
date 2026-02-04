import type {
  BuilderOptions,
  CardInDeck,
  CardInfo,
  CardRole,
  CommanderChoice,
  DeckList,
  OwnedCard,
} from "./types";
import { getCardsByNamesFromDb, getCardByNameFromDb } from "./cardDb";

const COMMANDER_BANLIST = new Set(
  [
    "Ancestral Recall", "Balance", "Biorhythm", "Black Lotus", "Braids, Cabal Minion",
    "Channel", "Chaos Orb", "Coalition Victory", "Emrakul, the Aeons Torn",
    "Erayo, Soratami Ascendant", "Falling Star", "Fastbond", "Gifts Ungiven",
    "Griselbrand", "Iona, Shield of Emeria", "Karakas", "Library of Alexandria",
    "Limited Resources", "Lutri, the Spellchaser", "Mox Emerald", "Mox Jet",
    "Mox Pearl", "Mox Ruby", "Mox Sapphire", "Panoptic Mirror", "Paradox Engine",
    "Primeval Titan", "Prophet of Kruphix", "Recurring Nightmare", "Rofellos, Llanowar Emissary",
    "Shahrazad", "Sundering Titan", "Sway of the Stars", "Time Vault", "Time Walk",
    "Tinker", "Tolarian Academy", "Trade Secrets", "Upheaval", "Yawgmoth's Bargain",
  ].map((s) => s.toLowerCase())
);

const RAMP_KEYWORDS = [
  "add {", "add one mana", "add two mana", "additional mana", "mana of any",
  "search your library for a basic", "search your library for a land",
  "put a land card", "put onto the battlefield tapped",
];
const DRAW_KEYWORDS = ["draw a card", "draw two", "draw three", "draw X", "draw cards"];
const REMOVAL_KEYWORDS = ["destroy target", "exile target", "deal damage to target", "destroy all", "exile all"];
const SWEEPER_KEYWORDS = ["destroy all", "exile all", "each creature", "each nonland"];
const FINISHER_KEYWORDS = ["trample", "flying", "haste", "double strike", "whenever ~ attacks"];

function assignRole(card: CardInfo): CardRole {
  const text = (card.oracleText ?? "").toLowerCase();
  const typeLine = (card.typeLine ?? "").toLowerCase();
  if (typeLine.includes("land")) return "land";

  if (RAMP_KEYWORDS.some((k) => text.includes(k.toLowerCase()))) return "ramp";
  if (DRAW_KEYWORDS.some((k) => text.includes(k.toLowerCase()))) return "draw";
  if (SWEEPER_KEYWORDS.some((k) => text.includes(k.toLowerCase())) && REMOVAL_KEYWORDS.some((k) => text.includes(k.toLowerCase()))) return "sweeper";
  if (REMOVAL_KEYWORDS.some((k) => text.includes(k.toLowerCase()))) return "removal";
  if (FINISHER_KEYWORDS.some((k) => text.includes(k.toLowerCase())) && (typeLine.includes("creature") || typeLine.includes("planeswalker"))) return "finisher";

  if (typeLine.includes("creature") || typeLine.includes("planeswalker")) return "synergy";
  return "utility";
}

/** Commander rule: card is legal if every color in its identity is in the commander's identity. */
function colorIdentityMatches(commanderIdentity: string[], card: CardInfo): boolean {
  const allowed = new Set(commanderIdentity);
  for (const c of card.colorIdentity ?? []) {
    if (!allowed.has(c)) return false;
  }
  return true;
}

function cardToDeckEntry(card: CardInfo, role?: CardRole): CardInDeck {
  return {
    name: card.name,
    quantity: 1,
    role: role ?? assignRole(card),
    cmc: card.cmc,
    imageUrl: card.imageUrl,
  };
}

export type BuildProgress = (stage: string, progress: number, message?: string) => void;

export async function buildDeck(params: {
  owned: OwnedCard[];
  commander: CommanderChoice;
  options: BuilderOptions;
  onProgress?: BuildProgress;
  /** When provided, skips fetching card data (use for enriched collections). */
  cardInfos?: Map<string, CardInfo>;
}): Promise<DeckList> {
  const { owned, commander, options, onProgress, cardInfos: preloadedCardInfos } = params;
  const identity = commander.colorIdentity ?? [];
  const enforceLegality = options.enforceLegality ?? true;

  let cardInfos: Map<string, CardInfo>;
  if (preloadedCardInfos && preloadedCardInfos.size > 0) {
    onProgress?.("fetching", 1, "Using saved card data");
    cardInfos = preloadedCardInfos;
  } else {
    const uniqueNames = [...new Set(owned.map((c) => c.name))];
    onProgress?.("fetching", 0, "Loading cards from database…");
    cardInfos = await getCardsByNamesFromDb(uniqueNames);
    const missing = uniqueNames.filter((n) => !cardInfos.has(n.toLowerCase()));
    if (missing.length > 0) {
      const list = missing.length <= 5 ? missing.join(", ") : `${missing.slice(0, 5).join(", ")} and ${missing.length - 5} more`;
      throw new Error(`Cards not in database: ${list}. Sync the card database from Settings first.`);
    }
    onProgress?.("fetching", 1, "Cards loaded");
  }

  const commanderInfo = preloadedCardInfos?.get(commander.name.toLowerCase())
    ?? await getCardByNameFromDb(commander.name);
  if (!commanderInfo) {
    throw new Error(`Commander not found: ${commander.name}. Sync the card database from Settings if you don't see commanders when searching.`);
  }
  onProgress?.("building", 0.5, "Building deck…");

  const candidateEntries: Array<{ card: CardInfo; owned: OwnedCard; role: CardRole }> = [];
  for (const o of owned) {
    const card = cardInfos.get(o.name.toLowerCase());
    if (!card || o.quantity < 1) continue;
    if (card.name.toLowerCase() === commander.name.toLowerCase()) continue;
    if (!colorIdentityMatches(identity, card)) continue;
    if (enforceLegality) {
      const leg = card.legalities?.["commander"];
      if (leg === "banned" || leg === "not_legal") continue;
      if (COMMANDER_BANLIST.has(card.name.toLowerCase())) continue;
    }
    candidateEntries.push({ card, owned: o, role: assignRole(card) });
  }

  const nonlandCandidates = candidateEntries.filter((e) => e.role !== "land");
  if (nonlandCandidates.length === 0) {
    if (owned.length === 0) {
      throw new Error(
        "No cards in your collection could be used. Sync the card database from Settings, then try again."
      );
    }
    throw new Error(
      "No nonland cards from your collection match this commander's color identity (or legality). Add nonland cards in the commander's colors, or turn off legality for casual play."
    );
  }

  const used = new Set<string>();
  const main: CardInDeck[] = [];
  const landSlots: CardInDeck[] = [];
  const targetRamp = 10;
  const targetDraw = 8;
  const targetRemoval = 8;
  const targetSweeper = 3;

  const byRole = (r: CardRole) =>
    candidateEntries.filter((e) => e.role === r && !used.has(e.card.name.toLowerCase()));

  const addBest = (pool: typeof candidateEntries, limit: number) => {
    const byCmc = [...pool].sort((a, b) => a.card.cmc - b.card.cmc);
    for (const e of byCmc) {
      if (main.length + landSlots.length >= 99) break;
      const key = e.card.name.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      main.push(cardToDeckEntry(e.card, e.role));
      if (main.length >= limit) break;
    }
  };

  addBest(byRole("ramp"), targetRamp);
  addBest(byRole("draw"), targetDraw);
  addBest(byRole("removal"), targetRemoval);
  addBest(byRole("sweeper"), targetSweeper);
  addBest(byRole("synergy"), 30);
  addBest(byRole("finisher"), 15);
  addBest(byRole("utility"), 99 - main.length);

  const landCandidates = candidateEntries.filter((e) => e.role === "land" && !used.has(e.card.name.toLowerCase()));
  const landByCmc = [...landCandidates].sort((a, b) => a.card.cmc - b.card.cmc);
  const landSlotsTarget = 99 - main.length;
  for (const e of landByCmc) {
    if (landSlots.length >= landSlotsTarget) break;
    used.add(e.card.name.toLowerCase());
    landSlots.push(cardToDeckEntry(e.card, "land"));
  }

  const colorToBasic: Record<string, string> = {
    W: "Plains",
    U: "Island",
    B: "Swamp",
    R: "Mountain",
    G: "Forest",
  };
  const basicsInIdentity = identity.map((c) => colorToBasic[c]).filter(Boolean);
  const needBasics = 99 - main.length - landSlots.length;
  for (let i = 0; i < needBasics && basicsInIdentity.length > 0; i++) {
    landSlots.push({
      name: basicsInIdentity[i % basicsInIdentity.length]!,
      quantity: 1,
      role: "land",
    });
  }

  const byRoleCount: Partial<Record<CardRole, number>> = {};
  for (const c of [...main, ...landSlots]) {
    const r = c.role ?? "other";
    byRoleCount[r] = (byRoleCount[r] ?? 0) + 1;
  }

  onProgress?.("building", 1, "Done");

  return {
    commander: {
      name: commander.name,
      quantity: 1,
      role: "other",
      imageUrl: commander.imageUrl ?? commanderInfo.imageUrl,
    },
    main,
    lands: landSlots,
    stats: {
      totalNonlands: main.length,
      totalLands: landSlots.length,
      byRole: byRoleCount,
      colorIdentity: identity,
    },
    legalityEnforced: enforceLegality,
  };
}
