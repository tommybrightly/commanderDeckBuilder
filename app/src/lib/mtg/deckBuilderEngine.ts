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

/**
 * Mana curve targets (commander-dependent in practice; these are defaults):
 * - Bell-shaped curve peaking at 2–3 MV; majority of nonlands in 2–4 MV.
 * - Target average MV below 3.0, often 2.5, for efficiency.
 */

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

/** Creature subtypes that commanders often care about (theme/tribe). Used to match commander text. */
const CREATURE_SUBTYPES = new Set([
  "angel", "demon", "dragon", "vampire", "elf", "goblin", "wizard", "zombie", "soldier", "warrior",
  "rogue", "cleric", "knight", "sliver", "spirit", "human", "cat", "dinosaur", "beast", "elemental",
  "hydra", "bird", "devil", "horror", "nightmare", "phyrexian", "eldrazi", "myr", "construct",
  "artificer", "pirate", "ninja", "samurai", "scout", "shaman", "druid", "merfolk", "kraken",
  "serpent", "leviathan", "sphinx", "naga", "ally", "ooze", "plant", "fungus", "insect", "spider",
  "djinn", "efreet", "vedalken", "pilot", "rat", "wolf", "bear", "turtle", "crab",
]);

/**
 * Extract creature types (tribes) the commander's ability cares about from oracle text only.
 * E.g. Kaalia "put an Angel, Demon, or Dragon" -> ["angel", "demon", "dragon"].
 * We use oracle text only so the commander's own type line (e.g. Human, Cleric) doesn't become the theme.
 */
function getPreferredTribes(commander: CardInfo): string[] {
  const raw = (commander.oracleText ?? "").toLowerCase();
  if (!raw.trim()) return [];
  const found: string[] = [];
  for (const subtype of CREATURE_SUBTYPES) {
    const re = new RegExp(`\\b${subtype}s?\\b`, "i");
    if (re.test(raw)) found.push(subtype);
  }
  return [...new Set(found)];
}

/** True if card's type line contains any of the given tribes (e.g. "Creature — Angel" matches "angel"). */
function cardMatchesTribes(card: CardInfo, tribes: string[]): boolean {
  if (tribes.length === 0) return false;
  const typeLine = (card.typeLine ?? "").toLowerCase();
  return tribes.some((t) => typeLine.includes(t));
}

/** True if the commander puts creatures (or specific types) onto the battlefield from hand/library, so high-CMC payoff creatures are desirable. */
function commanderCheatsCreatures(commander: CardInfo): boolean {
  const text = (commander.oracleText ?? "").toLowerCase();
  return /put\s+(a|an|target)\s+.*onto the battlefield/.test(text) || /put.*onto the battlefield.*(creature|angel|demon|dragon|card)/.test(text);
}

function typeLineIncludes(typeLine: string | undefined, type: string): boolean {
  return (typeLine ?? "").toLowerCase().includes(type.toLowerCase());
}

/** Primary nonland type for type-cap counting (creature, instant, sorcery, etc.). */
function primaryNonlandType(typeLine: string | undefined): string {
  const line = (typeLine ?? "").toLowerCase();
  if (line.includes("creature")) return "creature";
  if (line.includes("instant")) return "instant";
  if (line.includes("sorcery")) return "sorcery";
  if (line.includes("enchantment")) return "enchantment";
  if (line.includes("artifact")) return "artifact";
  if (line.includes("planeswalker")) return "planeswalker";
  return "other";
}

function countMainByType(main: CardInDeck[]): Record<string, number> {
  const counts: Record<string, number> = {
    creature: 0,
    instant: 0,
    sorcery: 0,
    enchantment: 0,
    artifact: 0,
    planeswalker: 0,
    other: 0,
  };
  for (const c of main) {
    const t = primaryNonlandType(c.typeLine);
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

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
  const identity = getEffectiveColorIdentity(card);
  for (const c of identity) {
    if (!allowed.has(c)) return false;
  }
  return true;
}

/** For lands with empty stored identity, infer from oracle text (e.g. "Plains" or "{W}" → W). */
function getEffectiveColorIdentity(card: CardInfo): string[] {
  const stored = card.colorIdentity ?? [];
  if (stored.length > 0) return stored;
  const typeLine = (card.typeLine ?? "").toLowerCase();
  if (!typeLine.includes("land")) return stored;

  const text = (card.oracleText ?? "").toLowerCase();
  // "Mana of any color" / "any color" → all five (card only legal in 5c decks)
  if (/mana of any color|add one mana of any color|any color of mana/.test(text))
    return ["W", "U", "B", "R", "G"];

  const inferred: string[] = [];
  if (/\{w\}|plains|white mana|add w\b|adds? w\b/.test(text)) inferred.push("W");
  if (/\{u\}|island|blue mana|add u\b|adds? u\b/.test(text)) inferred.push("U");
  if (/\{b\}|swamp|black mana|add b\b|adds? b\b/.test(text)) inferred.push("B");
  if (/\{r\}|mountain|red mana|add r\b|adds? r\b/.test(text)) inferred.push("R");
  if (/\{g\}|forest|green mana|add g\b|adds? g\b/.test(text)) inferred.push("G");
  return [...new Set(inferred)];
}

const BASIC_LAND_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest"]);
const MAX_LANDS = 40;

function cardToDeckEntry(card: CardInfo, role?: CardRole): CardInDeck {
  return {
    name: card.name,
    quantity: 1,
    role: role ?? assignRole(card),
    cmc: card.cmc,
    typeLine: card.typeLine,
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
  /** When provided, fill this partial deck to 99 instead of building from scratch. */
  initialDeck?: { main: CardInDeck[]; lands: CardInDeck[] };
}): Promise<DeckList> {
  const { owned, commander, options, onProgress, cardInfos: preloadedCardInfos, initialDeck } = params;
  const identity = commander.colorIdentity ?? [];
  const enforceLegality = options.enforceLegality ?? true;
  const archetype = options.archetype ?? "balanced";

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
  if (initialDeck) {
    for (const c of initialDeck.main) {
      main.push(c);
      used.add(c.name.toLowerCase());
    }
    for (const c of initialDeck.lands) {
      landSlots.push(c);
      used.add(c.name.toLowerCase());
    }
  }

  // Typical 99-card breakdown: 34–38 lands, 10–15 ramp, 10–12 draw, 10–15 removal, 3–6 wipes, 25–30 synergy
  const TARGET_LANDS = 36;
  const MAX_NONLANDS = 99 - TARGET_LANDS; // 63
  let targetRamp = 12;
  let targetDraw = 11;
  let targetRemoval = 12;
  let targetSweeper = 4;
  const targetThemeSynergy = 25;
  let targetFinisher = 4;

  const preferredTribes = getPreferredTribes(commanderInfo);
  const commanderCheats = commanderCheatsCreatures(commanderInfo);

  // Archetype-specific role targets and type caps
  if (archetype === "control") {
    targetRemoval = 15;
    targetDraw = 13;
    targetSweeper = 6;
  }
  if (archetype === "spellslinger") {
    targetDraw = 14;
  }
  if (archetype === "voltron") {
    targetFinisher = 6;
  }

  /** Ideal curve: bell peaking at 2–3 MV; target avg ≤ 3.0 (aim 2.5); majority 2–4 drops. */
  const TARGET_AVG_CMC = 2.5;
  const MAX_AVG_CMC = 3.0;

  /** How much we want a card at this CMC (1 = ideal band 2–4, peak 2–3). */
  function curveWeight(cmc: number): number {
    const c = typeof cmc === "number" ? cmc : 0;
    if (c <= 1) return 0.6;   // 0–1: fine for ramp, less ideal for general slots
    if (c === 2 || c === 3) return 1.0;  // peak
    if (c === 4) return 0.95;
    if (c === 5) return 0.65;
    if (c === 6) return 0.4;
    return 0.25;  // 7+
  }

  /** For commanders that cheat creatures (e.g. Kaalia): payoff creatures are good at high CMC, so we don't penalize 4–7. */
  function curveWeightForPayoff(cmc: number): number {
    const c = typeof cmc === "number" ? cmc : 0;
    if (c <= 1) return 0.5;
    if (c === 2 || c === 3) return 0.85;  // still fine
    if (c === 4 || c === 5 || c === 6) return 1.0;  // sweet spot for cheated payoffs
    return 0.9;  // 7+ still good
  }

  /** Score for adding this card given current main (higher = better curve fit). */
  function curveScore(card: CardInfo, currentMain: CardInDeck[]): number {
    const cmc = typeof card.cmc === "number" ? card.cmc : 0;
    const totalCmc = currentMain.reduce((s, c) => s + (c.cmc ?? 0), 0);
    const count = currentMain.length;
    const newAvg = (totalCmc + cmc) / (count + 1);
    const weight = curveWeight(cmc);
    const avgPenalty = newAvg > MAX_AVG_CMC ? (newAvg - MAX_AVG_CMC) * 0.5 : 0;
    const towardTarget = Math.abs(newAvg - TARGET_AVG_CMC) < Math.abs((totalCmc / (count || 1)) - TARGET_AVG_CMC) ? 0.1 : 0;
    return weight - avgPenalty + towardTarget;
  }

  /**
   * Score for theme/synergy/finisher slots: prioritizes commander's game plan.
   * Tribe-matching cards get a large bonus so they beat generic curve filler.
   * When the commander cheats creatures (e.g. Kaalia), tribe payoff creatures use a flatter curve so big Angels/Demons/Dragons rank above small filler.
   */
  function themeAwareScore(card: CardInfo, currentMain: CardInDeck[]): number {
    const matchesTribe = preferredTribes.length > 0 && cardMatchesTribes(card, preferredTribes);
    const isPayoffCreature = matchesTribe && typeLineIncludes(card.typeLine, "creature") && commanderCheats;
    const cmc = typeof card.cmc === "number" ? card.cmc : 0;
    const totalCmc = currentMain.reduce((s, c) => s + (c.cmc ?? 0), 0);
    const count = currentMain.length;
    const newAvg = (totalCmc + cmc) / (count + 1);
    const weight = isPayoffCreature ? curveWeightForPayoff(cmc) : curveWeight(cmc);
    const avgPenalty = newAvg > MAX_AVG_CMC ? (newAvg - MAX_AVG_CMC) * 0.3 : 0;  // lighter penalty for theme slots
    const towardTarget = Math.abs(newAvg - TARGET_AVG_CMC) < Math.abs((totalCmc / (count || 1)) - TARGET_AVG_CMC) ? 0.1 : 0;
    const base = weight - avgPenalty + towardTarget;
    const themeBonus = matchesTribe ? 2.5 : 0;  // so tribe cards reliably beat generic 2-drops (curve ~1.0)
    return base + themeBonus;
  }

  /** Score for spellslinger: favor instants and sorceries. */
  function spellslingerScore(card: CardInfo, currentMain: CardInDeck[]): number {
    const base = curveScore(card, currentMain);
    const line = (card.typeLine ?? "").toLowerCase();
    const spellBonus = (line.includes("instant") || line.includes("sorcery")) ? 1.8 : 0;
    return base + spellBonus;
  }

  /** Score for voltron: favor equipment and auras. */
  function voltronScore(card: CardInfo, currentMain: CardInDeck[]): number {
    const base = curveScore(card, currentMain);
    const line = (card.typeLine ?? "").toLowerCase();
    const voltronBonus = (line.includes("equipment") || line.includes("aura")) ? 2.0 : 0;
    return base + voltronBonus;
  }

  type ScoreFn = (card: CardInfo, currentMain: CardInDeck[]) => number;

  /** Which score to use for synergy/finisher/creature by archetype. */
  const synergyScoreFn: ScoreFn =
    archetype === "spellslinger" ? spellslingerScore
    : archetype === "voltron" ? curveScore
    : archetype === "control" ? curveScore
    : (preferredTribes.length > 0 || archetype === "tribal") ? themeAwareScore
    : curveScore;

  const byRole = (r: CardRole) =>
    candidateEntries.filter((e) => e.role === r && !used.has(e.card.name.toLowerCase()));

  // Type balance and creature targets by archetype
  const { minCreatures: MIN_CREATURES, targetCreatures: TARGET_CREATURES, maxInstants: MAX_INSTANTS, maxSorceries: MAX_SORCERIES } = (() => {
    switch (archetype) {
      case "tribal":
        return { minCreatures: 25, targetCreatures: 32, maxInstants: 12, maxSorceries: 8 };
      case "spellslinger":
        return { minCreatures: 0, targetCreatures: 10, maxInstants: 28, maxSorceries: 22 };
      case "voltron":
        return { minCreatures: 18, targetCreatures: 22, maxInstants: 12, maxSorceries: 10 };
      case "control":
        return { minCreatures: 16, targetCreatures: 20, maxInstants: 16, maxSorceries: 12 };
      default:
        return {
          minCreatures: 20,
          targetCreatures: preferredTribes.length > 0 ? 30 : 27,
          maxInstants: 14,
          maxSorceries: 10,
        };
    }
  })();

  /**
   * Add up to `limit` cards from the pool. We treat the pool as "potentials" for this slot:
   * sort by the given score (default curve), then take the best among them in order, skipping
   * only cards that would exceed type caps.
   */
  const addBest = (
    pool: typeof candidateEntries,
    limit: number,
    opts?: { onlyType?: "creature"; scoreFn?: ScoreFn }
  ) => {
    const scoreFn = opts?.scoreFn ?? curveScore;
    const potentials = [...pool].sort((a, b) => {
      const scoreA = scoreFn(a.card, main);
      const scoreB = scoreFn(b.card, main);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.card.cmc ?? 0) - (b.card.cmc ?? 0);
    });
    for (const e of potentials) {
      if (main.length >= limit || main.length >= MAX_NONLANDS) break;
      const key = e.card.name.toLowerCase();
      if (used.has(key)) continue;
      if (opts?.onlyType && primaryNonlandType(e.card.typeLine) !== opts.onlyType) continue;
      const counts = countMainByType(main);
      const cardType = primaryNonlandType(e.card.typeLine);
      if (cardType === "instant" && (counts.instant ?? 0) >= MAX_INSTANTS) continue;
      if (cardType === "sorcery" && (counts.sorcery ?? 0) >= MAX_SORCERIES) continue;
      used.add(key);
      main.push(cardToDeckEntry(e.card, e.role));
    }
  };

  addBest(byRole("ramp"), targetRamp);
  addBest(byRole("draw"), targetDraw);
  addBest(byRole("removal"), targetRemoval);
  addBest(byRole("sweeper"), targetSweeper);

  // Voltron: prioritize equipment and auras early
  if (archetype === "voltron") {
    const equipmentAuraPool = candidateEntries.filter(
      (e) =>
        e.role !== "land" &&
        !used.has(e.card.name.toLowerCase()) &&
        (typeLineIncludes(e.card.typeLine, "Equipment") || typeLineIncludes(e.card.typeLine, "Aura"))
    );
    addBest(equipmentAuraPool, 14, { scoreFn: voltronScore });
  }

  // Theme/synergy/finisher: scoring depends on archetype (theme-aware for balanced/tribal, spellslinger/voltron/control use their own)
  if (preferredTribes.length > 0 && archetype !== "spellslinger") {
    const themePool = candidateEntries.filter(
      (e) =>
        e.role !== "land" &&
        !used.has(e.card.name.toLowerCase()) &&
        (e.role === "synergy" || e.role === "finisher") &&
        cardMatchesTribes(e.card, preferredTribes)
    );
    addBest(themePool, targetThemeSynergy, { scoreFn: synergyScoreFn });
  }

  addBest(byRole("synergy"), targetThemeSynergy, { scoreFn: synergyScoreFn });
  addBest(byRole("finisher"), targetFinisher, { scoreFn: synergyScoreFn });

  // Reserve slots for enchantments and sorceries (still respect type caps)
  const utilityEnchantments = candidateEntries.filter(
    (e) => e.role === "utility" && !used.has(e.card.name.toLowerCase()) && typeLineIncludes(e.card.typeLine, "enchantment")
  );
  const utilitySorceries = candidateEntries.filter(
    (e) => e.role === "utility" && !used.has(e.card.name.toLowerCase()) && typeLineIncludes(e.card.typeLine, "sorcery")
  );
  addBest(utilityEnchantments, 5);
  addBest(utilitySorceries, 5);
  // Spellslinger: favor instants/sorceries in utility
  addBest(byRole("utility"), MAX_NONLANDS - main.length, archetype === "spellslinger" ? { scoreFn: spellslingerScore } : undefined);

  // Hit creature target (archetype-dependent). Prefer commander-theme when balanced/tribal.
  const creatureCount = countMainByType(main).creature ?? 0;
  if (creatureCount < TARGET_CREATURES && main.length < MAX_NONLANDS && TARGET_CREATURES > 0) {
    const creaturePool = candidateEntries.filter(
      (e) =>
        e.role !== "land" &&
        !used.has(e.card.name.toLowerCase()) &&
        typeLineIncludes(e.card.typeLine, "creature")
    );
    const toAdd = Math.min(TARGET_CREATURES - creatureCount, MAX_NONLANDS - main.length);
    addBest(creaturePool, main.length + toAdd, { onlyType: "creature", scoreFn: synergyScoreFn });
  }

  // Lands must match commander color identity (use effective identity for lands with empty stored).
  // Exclude basic land names so we add basics for free and don't use collection slots for them.
  const landCandidates = candidateEntries.filter(
    (e) =>
      e.role === "land" &&
      !used.has(e.card.name.toLowerCase()) &&
      colorIdentityMatches(identity, e.card) &&
      !BASIC_LAND_NAMES.has(e.card.name.toLowerCase().trim())
  );
  const landByCmc = [...landCandidates].sort((a, b) => a.card.cmc - b.card.cmc);
  const landSlotsTarget = Math.min(99 - main.length, MAX_LANDS);
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
  const maxBasicsToAdd = Math.max(0, MAX_LANDS - landSlots.length);
  const needBasics = Math.min(99 - main.length - landSlots.length, maxBasicsToAdd);
  for (let i = 0; i < needBasics && basicsInIdentity.length > 0; i++) {
    landSlots.push({
      name: basicsInIdentity[i % basicsInIdentity.length]!,
      quantity: 1,
      role: "land",
    });
  }

  if (main.length + landSlots.length > 99) {
    landSlots.length = Math.min(99 - main.length, MAX_LANDS);
  }

  const byRoleCount: Partial<Record<CardRole, number>> = {};
  for (const c of [...main, ...landSlots]) {
    const r = c.role ?? "other";
    byRoleCount[r] = (byRoleCount[r] ?? 0) + 1;
  }

  const totalCards = main.length + landSlots.length;
  const shortBy = totalCards < 99 ? 99 - totalCards : undefined;

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
      ...(shortBy != null && { shortBy }),
    },
    legalityEnforced: enforceLegality,
  };
}

/** Strip "1. ", "- ", etc. and normalize spaces for card name lookup. */
function normalizeCardName(name: string): string {
  return name
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^\s*[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a deck list from AI-provided card names. Validates each name against owned and cardInfos.
 * Routes by actual card type (land vs nonland) so we get correct main/lands regardless of AI order.
 * Returns null if the list is unusable (e.g. no valid cards).
 */
export function buildDeckFromCardNames(params: {
  mainNames: string[];
  landNames: string[];
  owned: OwnedCard[];
  commander: CommanderChoice;
  cardInfos: Map<string, CardInfo>;
  enforceLegality: boolean;
  commanderInfo: CardInfo;
}): DeckList | null {
  const { mainNames, landNames, owned, commander, cardInfos, enforceLegality, commanderInfo } = params;
  const identity = commander.colorIdentity ?? [];
  const ownedSet = new Set(owned.map((c) => c.name.toLowerCase()));
  const main: CardInDeck[] = [];
  const landSlots: CardInDeck[] = [];
  const used = new Set<string>();

  const allNames = [...mainNames, ...landNames];
  for (const name of allNames) {
    const key = normalizeCardName(name);
    if (!key || used.has(key.toLowerCase())) continue;
    const card = cardInfos.get(key.toLowerCase());
    if (card) {
      if (!ownedSet.has(key.toLowerCase())) continue;
      if (!colorIdentityMatches(identity, card)) continue;
      if (card.name.toLowerCase() === commander.name.toLowerCase()) continue;
      if (enforceLegality) {
        const leg = card.legalities?.["commander"];
        if (leg === "banned" || leg === "not_legal") continue;
        if (COMMANDER_BANLIST.has(card.name.toLowerCase())) continue;
      }
      const typeLine = (card.typeLine ?? "").toLowerCase();
      if (typeLine.includes("land")) {
        if (landSlots.length < MAX_LANDS) {
          used.add(key.toLowerCase());
          landSlots.push(cardToDeckEntry(card, "land"));
        }
      } else {
        if (main.length < 63) {
          used.add(key.toLowerCase());
          main.push(cardToDeckEntry(card));
        }
      }
    } else if (BASIC_LAND_NAMES.has(key.toLowerCase()) && landSlots.length < MAX_LANDS) {
      const basicColor: Record<string, string> = { plains: "W", island: "U", swamp: "B", mountain: "R", forest: "G" };
      const color = basicColor[key.toLowerCase()];
      if (color && identity.includes(color)) {
        used.add(key.toLowerCase());
        landSlots.push({ name: key, quantity: 1, role: "land" });
      }
    }
  }

  const colorToBasic: Record<string, string> = {
    W: "Plains",
    U: "Island",
    B: "Swamp",
    R: "Mountain",
    G: "Forest",
  };
  const basicsInIdentity = identity.map((c) => colorToBasic[c]).filter(Boolean);
  const landSlotsTarget = Math.min(99 - main.length, MAX_LANDS);
  const maxBasicsToAdd = Math.max(0, landSlotsTarget - landSlots.length);
  const needBasics = Math.min(99 - main.length - landSlots.length, maxBasicsToAdd);
  for (let i = 0; i < needBasics && basicsInIdentity.length > 0; i++) {
    landSlots.push({
      name: basicsInIdentity[i % basicsInIdentity.length]!,
      quantity: 1,
      role: "land",
    });
  }

  if (main.length + landSlots.length > 99) {
    landSlots.length = Math.min(99 - main.length, MAX_LANDS);
  }

  if (main.length === 0 && landSlots.length === 0) return null;

  const byRoleCount: Partial<Record<CardRole, number>> = {};
  for (const c of [...main, ...landSlots]) {
    const r = c.role ?? "other";
    byRoleCount[r] = (byRoleCount[r] ?? 0) + 1;
  }
  const totalCards = main.length + landSlots.length;
  const shortBy = totalCards < 99 ? 99 - totalCards : undefined;

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
      ...(shortBy != null && { shortBy }),
    },
    legalityEnforced: enforceLegality,
  };
}
