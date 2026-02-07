import type { CardInfo, CardInDeck, CommanderChoice, DeckList, OwnedCard } from "./types";
import type { CommanderPlan } from "./commanderPlan";
import type { ProfileTargets } from "./profileTargets";
import { countByRoleFamily } from "./roleAssignment";
import { getCommanderPlan } from "./commanderPlan";
import { getProfileTargets } from "./profileTargets";
import { buildDeck } from "./deckBuilderEngine";
import { commanderSynergyScore } from "./commanderThemes";
import type { CommanderThemeId } from "./commanderThemes";

/**
 * Phase 7: Evaluation harness — metrics per built deck and regression testing.
 */

export interface DeckMetrics {
  /** Average CMC of nonlands. */
  avgCmc: number;
  /** Variance of CMC. */
  cmcVariance: number;
  /** 0–1: how close avg CMC is to profile target. */
  curveScore: number;
  /** Per-role-family: { current, target, met }. */
  roleRatios: Record<string, { current: number; target: number; met: boolean }>;
  /** 0–1: fraction of role targets met (within tolerance). */
  roleRatioScore: number;
  /** 0–1: average commander synergy of main deck. */
  synergyDensity: number;
  /** Land count. */
  landCount: number;
  /** 0–1: land count in profile range. */
  manaStabilityScore: number;
  /** Count of finisher/wincon. */
  winconPresence: number;
  /** Total removal + sweeper + interaction + protection. */
  interactionCoverage: number;
  /** 0–1: interaction >= profile.minInteractionTotal. */
  interactionScore: number;
  /** Composite 0–1 score for regression. */
  compositeScore: number;
}

const INTERACTION_FAMILIES = ["removal", "sweeper", "interaction", "protection"] as const;
const ROLE_TOLERANCE = 2; // within 2 of target counts as "met"

/**
 * Compute metrics for a built deck (curve, roles, synergy, interaction, etc.).
 */
export function computeDeckMetrics(
  deckList: DeckList,
  cardInfos: Map<string, CardInfo>,
  plan: CommanderPlan,
  profile: ProfileTargets
): DeckMetrics {
  const main = deckList.main;
  const lands = deckList.lands;
  const mainCount = main.length;
  const landCount = lands.length;

  const avgCmc =
    mainCount > 0
      ? main.reduce((s, c) => s + (c.cmc ?? 0), 0) / mainCount
      : 0;
  const cmcVariance =
    mainCount > 0
      ? main.reduce((s, c) => s + ((c.cmc ?? 0) - avgCmc) ** 2, 0) / mainCount
      : 0;
  const curvePenalty = Math.abs(avgCmc - profile.targetAvgCmc);
  const curveScore = Math.max(0, 1 - curvePenalty * 0.2 - cmcVariance * 0.05);

  const counts = countByRoleFamily(main);
  const roleTargets: Record<string, number> = {
    ramp: profile.targetRamp,
    draw: profile.targetDraw,
    removal: profile.targetRemoval,
    interaction: profile.targetInteraction,
    sweeper: profile.targetSweeper,
    finisher: profile.targetFinisher,
  };
  const roleRatios: DeckMetrics["roleRatios"] = {};
  let roleMet = 0;
  for (const [family, target] of Object.entries(roleTargets)) {
    const current = counts[family as keyof typeof counts] ?? 0;
    const met = Math.abs(current - target) <= ROLE_TOLERANCE;
    roleRatios[family] = { current, target, met };
    if (met) roleMet++;
  }
  const roleRatioScore = Object.keys(roleTargets).length > 0 ? roleMet / Object.keys(roleTargets).length : 1;

  const mainInfos = main
    .map((c) => cardInfos.get(c.name.toLowerCase()))
    .filter(Boolean) as CardInfo[];
  const commanderThemes: CommanderThemeId[] = plan.primaryThemes;
  const synergyDensity =
    mainInfos.length > 0
      ? mainInfos.reduce((s, c) => s + commanderSynergyScore(c, commanderThemes), 0) / mainInfos.length
      : 0;
  const synergyNorm = Math.min(1, synergyDensity / 2); // cap so 2.0 synergy = 1.0

  const landInRange =
    landCount >= profile.targetLandsMin && landCount <= profile.targetLandsMax;
  const manaStabilityScore = landInRange ? 1 : landCount < profile.targetLandsMin ? landCount / profile.targetLandsMin : 0;

  const winconPresence = (counts.finisher ?? 0) + (counts.wincon ?? 0);
  const interactionCoverage = INTERACTION_FAMILIES.reduce(
    (s, f) => s + (counts[f] ?? 0),
    0
  );
  const interactionScore =
    interactionCoverage >= profile.minInteractionTotal
      ? 1
      : interactionCoverage / profile.minInteractionTotal;

  const compositeScore =
    curveScore * 0.2 +
    roleRatioScore * 0.25 +
    synergyNorm * 0.15 +
    manaStabilityScore * 0.15 +
    (winconPresence >= 2 ? 0.1 : winconPresence * 0.05) +
    interactionScore * 0.25;

  return {
    avgCmc,
    cmcVariance,
    curveScore,
    roleRatios,
    roleRatioScore,
    synergyDensity: synergyNorm,
    landCount,
    manaStabilityScore,
    winconPresence,
    interactionCoverage,
    interactionScore,
    compositeScore,
  };
}

/** Reference commander entry: name, identity, and recommended card names for synthetic pool. */
export interface ReferenceCommander {
  id: string;
  name: string;
  colorIdentity: string[];
  /** Card names to include in the synthetic "owned" pool (theme/role-relevant). */
  recommendedCardNames: string[];
}

/** Minimal reference set for harness (expand with real EDHREC-style data later). */
export const REFERENCE_COMMANDERS: ReferenceCommander[] = [
  {
    id: "atraxa",
    name: "Atraxa, Praetors' Voice",
    colorIdentity: ["W", "U", "B", "G"],
    recommendedCardNames: [
      "Sol Ring", "Birds of Paradise", "Counterspell", "Swords to Plowshares",
      "Eternal Witness", "Smothering Tithe", "Rhystic Study", "Demonic Tutor",
      "Farseek", "Rampant Growth", "Cultivate", "Kodama's Reach",
      "Sylvan Library", "Necropotence", "Beast Within", "Anguished Unmaking",
      "Vampiric Tutor", "Mystic Remora", "Sakura-Tribe Elder", "Birds of Paradise",
      ...Array.from({ length: 30 }, (_, i) => `Atraxa Filler ${i}`),
    ],
  },
  {
    id: "kaalia",
    name: "Kaalia of the Vast",
    colorIdentity: ["W", "B", "R"],
    recommendedCardNames: [
      "Sol Ring", "Birds of Paradise", "Lightning Bolt", "Angelic Arbiter",
      "Rakdos the Defiler", "Avacyn, Angel of Hope", "Gisela, Blade of Goldnight",
      "Solemn Simulacrum", "Talisman of Conviction", "Talisman of Indulgence",
      "Chaos Warp", "Path to Exile", "Swords to Plowshares", "Utter End",
      "Read the Bones", "Sign in Blood", "Night's Whisper", "Faithless Looting",
      ...Array.from({ length: 30 }, (_, i) => `Kaalia Filler ${i}`),
    ],
  },
  {
    id: "ur-dragon",
    name: "The Ur-Dragon",
    colorIdentity: ["W", "U", "B", "R", "G"],
    recommendedCardNames: [
      "Sol Ring", "Birds of Paradise", "Chromanticore", "Dragonlord Atarka",
      "Dragonlord Dromoka", "Dragonlord Ojutai", "Dragonlord Silumgar", "Dragonlord Kolaghan",
      "Farseek", "Rampant Growth", "Cultivate", "Kodama's Reach", "Sakura-Tribe Elder",
      "Counterspell", "Chaos Warp", "Beast Within", "Cyclonic Rift",
      "Sarkhan's Unsealing", "Dragon Tempest", "Scourge of Valkas",
      ...Array.from({ length: 35 }, (_, i) => `Dragon Filler ${i}`),
    ],
  },
];

function minimalCardInfo(
  name: string,
  opts: { colorIdentity?: string[]; typeLine?: string; oracleText?: string; cmc?: number }
): CardInfo {
  const id = name.toLowerCase().replace(/\s+/g, "-");
  const typeLine = opts.typeLine ?? "Creature";
  const colorIdentity = opts.colorIdentity ?? ["W", "U", "B", "R", "G"].slice(0, 2);
  return {
    id,
    name,
    cmc: opts.cmc ?? 2,
    colors: colorIdentity,
    colorIdentity,
    typeLine,
    oracleText: opts.oracleText,
    legalities: { commander: "legal" },
    types: typeLine.split(" "),
  };
}

/** Build synthetic CardInfo map for a reference commander and pool. */
function buildSyntheticCardInfos(ref: ReferenceCommander): Map<string, CardInfo> {
  const map = new Map<string, CardInfo>();
  const isWUBRG = ref.colorIdentity.length >= 5;
  const identity = ref.colorIdentity;

  const commanderOracle: Record<string, string> = {
    "Atraxa, Praetors' Voice": "Flying, vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate.",
    "Kaalia of the Vast": "Flying. Whenever Kaalia attacks, you may put an Angel, Demon, or Dragon onto the battlefield.",
    "The Ur-Dragon": "Eminence — Dragons you control cost 1 less to cast. Flying. Dragon spells you cast cost 1 less.",
  };
  map.set(
    ref.name.toLowerCase(),
    minimalCardInfo(ref.name, {
      colorIdentity: identity,
      typeLine: "Legendary Creature",
      oracleText: commanderOracle[ref.name] ?? "",
      cmc: 4,
    })
  );

  const knownCards: Record<string, Partial<CardInfo>> = {
    "Sol Ring": { typeLine: "Artifact", oracleText: "Add one mana of any color.", colorIdentity: [], cmc: 1 },
    "Birds of Paradise": { typeLine: "Creature", oracleText: "Add one mana of any color.", colorIdentity: ["G"], cmc: 1 },
    "Counterspell": { typeLine: "Instant", oracleText: "Counter target spell.", colorIdentity: ["U"], cmc: 2 },
    "Swords to Plowshares": { typeLine: "Instant", oracleText: "Exile target creature.", colorIdentity: ["W"], cmc: 1 },
    "Lightning Bolt": { typeLine: "Instant", oracleText: "Deal 3 damage.", colorIdentity: ["R"], cmc: 1 },
    "Rampant Growth": { typeLine: "Sorcery", oracleText: "Search for a basic land.", colorIdentity: ["G"], cmc: 2 },
    "Cultivate": { typeLine: "Sorcery", oracleText: "Search for up to two basic lands.", colorIdentity: ["G"], cmc: 3 },
    "Farseek": { typeLine: "Sorcery", oracleText: "Search for a Forest, Plains, Island, or Mountain.", colorIdentity: ["G"], cmc: 2 },
    "Kodama's Reach": { typeLine: "Sorcery", oracleText: "Search for two basic lands.", colorIdentity: ["G"], cmc: 3 },
    "Sakura-Tribe Elder": { typeLine: "Creature", oracleText: "Sacrifice: Search for a basic land.", colorIdentity: ["G"], cmc: 2 },
    "Cyclonic Rift": { typeLine: "Instant", oracleText: "Return all nonland permanents to hand.", colorIdentity: ["U"], cmc: 2 },
    "Beast Within": { typeLine: "Instant", oracleText: "Destroy target permanent.", colorIdentity: ["G"], cmc: 3 },
    "Chaos Warp": { typeLine: "Instant", oracleText: "Shuffle target permanent into library.", colorIdentity: ["R"], cmc: 3 },
    "Path to Exile": { typeLine: "Instant", oracleText: "Exile target creature.", colorIdentity: ["W"], cmc: 1 },
    "Demonic Tutor": { typeLine: "Sorcery", oracleText: "Search your library for a card.", colorIdentity: ["B"], cmc: 2 },
    "Vampiric Tutor": { typeLine: "Instant", oracleText: "Search your library for a card.", colorIdentity: ["B"], cmc: 1 },
    "Smothering Tithe": { typeLine: "Enchantment", oracleText: "Whenever an opponent draws a card, create a Treasure.", colorIdentity: ["W"], cmc: 4 },
    "Rhystic Study": { typeLine: "Enchantment", oracleText: "Whenever an opponent casts a spell, you may draw a card.", colorIdentity: ["U"], cmc: 3 },
    "Necropotence": { typeLine: "Enchantment", oracleText: "Skip your draw step. Pay 1 life: Draw a card.", colorIdentity: ["B"], cmc: 3 },
    "Sylvan Library": { typeLine: "Enchantment", oracleText: "At the beginning of your draw step, draw two extra cards.", colorIdentity: ["G"], cmc: 2 },
    "Eternal Witness": { typeLine: "Creature", oracleText: "Return target card from your graveyard to your hand.", colorIdentity: ["G"], cmc: 2 },
    "Utter End": { typeLine: "Instant", oracleText: "Exile target nonland permanent.", colorIdentity: ["W", "B"], cmc: 4 },
    "Read the Bones": { typeLine: "Sorcery", oracleText: "Scry 2, then draw two cards.", colorIdentity: ["B"], cmc: 3 },
    "Sign in Blood": { typeLine: "Sorcery", oracleText: "Target player draws two cards and loses 2 life.", colorIdentity: ["B"], cmc: 2 },
    "Night's Whisper": { typeLine: "Sorcery", oracleText: "Draw two cards and lose 2 life.", colorIdentity: ["B"], cmc: 2 },
    "Faithless Looting": { typeLine: "Instant", oracleText: "Draw two cards, then discard two cards.", colorIdentity: ["R"], cmc: 1 },
    "Mystic Remora": { typeLine: "Enchantment", oracleText: "Whenever an opponent casts a noncreature spell, you may draw a card.", colorIdentity: ["U"], cmc: 1 },
    "Anguished Unmaking": { typeLine: "Instant", oracleText: "Exile target permanent. You lose 3 life.", colorIdentity: ["W", "B"], cmc: 3 },
    "Talisman of Conviction": { typeLine: "Artifact", oracleText: "Add R or W.", colorIdentity: ["R", "W"], cmc: 2 },
    "Talisman of Indulgence": { typeLine: "Artifact", oracleText: "Add B or R.", colorIdentity: ["B", "R"], cmc: 2 },
    "Solemn Simulacrum": { typeLine: "Artifact Creature", oracleText: "Enters: search for a basic land. Dies: draw a card.", colorIdentity: [], cmc: 4 },
    "Angelic Arbiter": { typeLine: "Creature — Angel", colorIdentity: ["W", "U"], cmc: 7 },
    "Rakdos the Defiler": { typeLine: "Creature — Demon", colorIdentity: ["B", "R"], cmc: 6 },
    "Avacyn, Angel of Hope": { typeLine: "Legendary Creature — Angel", colorIdentity: ["W"], cmc: 8 },
    "Gisela, Blade of Goldnight": { typeLine: "Legendary Creature — Angel", colorIdentity: ["W", "R"], cmc: 7 },
    "Chromanticore": { typeLine: "Creature — Manticore", colorIdentity: ["W", "U", "B", "R", "G"], cmc: 5 },
    "Dragonlord Atarka": { typeLine: "Legendary Creature — Dragon", colorIdentity: ["R", "G"], cmc: 7 },
    "Dragonlord Dromoka": { typeLine: "Legendary Creature — Dragon", colorIdentity: ["W", "G"], cmc: 6 },
    "Dragonlord Ojutai": { typeLine: "Legendary Creature — Dragon", colorIdentity: ["W", "U"], cmc: 5 },
    "Dragonlord Silumgar": { typeLine: "Legendary Creature — Dragon", colorIdentity: ["U", "B"], cmc: 6 },
    "Dragonlord Kolaghan": { typeLine: "Legendary Creature — Dragon", colorIdentity: ["B", "R"], cmc: 5 },
    "Sarkhan's Unsealing": { typeLine: "Enchantment", oracleText: "Whenever you cast a creature with power 4 or greater, deal 4 damage.", colorIdentity: ["R"], cmc: 4 },
    "Dragon Tempest": { typeLine: "Enchantment", oracleText: "Whenever a Dragon enters, it gains haste and you may have it deal 2 damage.", colorIdentity: ["R"], cmc: 2 },
    "Scourge of Valkas": { typeLine: "Creature — Dragon", oracleText: "Whenever a Dragon enters, Scourge deals 1 damage to any target.", colorIdentity: ["R"], cmc: 4 },
  };

  for (const name of ref.recommendedCardNames) {
    const key = name.toLowerCase();
    if (map.has(key)) continue;
    const known = knownCards[name];
    const colorIdentity = known?.colorIdentity ?? identity;
    const legal = colorIdentity.every((c) => identity.includes(c));
    if (!legal && colorIdentity.length > 0) continue; // skip off-identity known cards
    map.set(
      key,
      minimalCardInfo(name, {
        colorIdentity: known?.colorIdentity ?? identity,
        typeLine: known?.typeLine ?? "Creature",
        oracleText: known?.oracleText,
        cmc: known?.cmc ?? 2,
      })
    );
  }

  // Filler: ensure we have enough cards for 99 (buffer so strict identity still has 65+ nonlands, 38+ lands)
  const needNonlands = 72;
  const needLands = 42;
  let nonlandCount = 0;
  let landCount = 0;
  for (const name of ref.recommendedCardNames) {
    const info = map.get(name.toLowerCase());
    if (info) {
      if ((info.typeLine ?? "").toLowerCase().includes("land")) landCount++;
      else nonlandCount++;
    }
  }
  // Tribe-matching type lines for tribal commanders so theme/synergy pools are non-empty
  const tribeTypeLines: string[] = [];
  if (ref.id === "kaalia") tribeTypeLines.push("Creature — Angel", "Creature — Demon", "Creature — Dragon");
  if (ref.id === "ur-dragon") tribeTypeLines.push("Creature — Dragon");
  const getTypeLine = (i: number) =>
    tribeTypeLines.length > 0 ? tribeTypeLines[i % tribeTypeLines.length]! : "Creature";

  for (let i = 0; nonlandCount < needNonlands; i++) {
    const name = `Filler Nonland ${ref.id} ${i}`;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, minimalCardInfo(name, { colorIdentity: identity, typeLine: getTypeLine(i), cmc: (i % 5) + 1 }));
      nonlandCount++;
    }
  }
  for (let i = 0; landCount < needLands; i++) {
    const name = `Filler Land ${ref.id} ${i}`;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, minimalCardInfo(name, { colorIdentity: identity, typeLine: "Land", cmc: 0 }));
      landCount++;
    }
  }

  return map;
}

export interface HarnessResult {
  commanderName: string;
  success: boolean;
  error?: string;
  metrics?: DeckMetrics;
  totalCards?: number;
}

export interface RunHarnessOptions {
  /** Reference commanders to run (default: all). */
  commanders?: ReferenceCommander[];
  /** Builder options (default: enforceLegality true, balanced). */
  options?: { enforceLegality?: boolean; archetype?: string };
}

/**
 * Run the evaluation harness: for each reference commander, build a deck from a synthetic pool and compute metrics.
 */
export async function runHarness(opts: RunHarnessOptions = {}): Promise<HarnessResult[]> {
  const refs = opts.commanders ?? REFERENCE_COMMANDERS;
  const options = {
    enforceLegality: opts.options?.enforceLegality ?? true,
    archetype: (opts.options?.archetype ?? "balanced") as "balanced" | "tribal" | "spellslinger" | "voltron" | "control",
  };
  const results: HarnessResult[] = [];

  for (const ref of refs) {
    try {
      const cardInfos = buildSyntheticCardInfos(ref);
      const commanderInfo = cardInfos.get(ref.name.toLowerCase());
      if (!commanderInfo) {
        results.push({ commanderName: ref.name, success: false, error: "Commander not in cardInfos" });
        continue;
      }
      const owned: OwnedCard[] = Array.from(cardInfos.values()).map((c) => ({
        name: c.name,
        quantity: 1,
      }));
      const commander: CommanderChoice = {
        id: ref.id,
        name: ref.name,
        colorIdentity: ref.colorIdentity,
      };
      const deckList = await buildDeck({
        owned,
        commander,
        options: { enforceLegality: options.enforceLegality, archetype: options.archetype },
        cardInfos,
      });
      const totalCards = deckList.main.length + deckList.lands.length;
      const plan = getCommanderPlan(commanderInfo);
      const profile = getProfileTargets(
        plan,
        { enforceLegality: options.enforceLegality, archetype: options.archetype }
      );
      const metrics = computeDeckMetrics(deckList, cardInfos, plan, profile);
      results.push({
        commanderName: ref.name,
        success: true,
        metrics,
        totalCards,
      });
    } catch (e) {
      results.push({
        commanderName: ref.name,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
