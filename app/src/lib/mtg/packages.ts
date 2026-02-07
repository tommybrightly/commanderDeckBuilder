import type { CardInfo } from "./types";
import type { RequiredPackageId, WinConditionTargets } from "./commanderPlan";
import type { CommanderPlan } from "./commanderPlan";

/**
 * Package definitions: detect which cards fill which strategy "package" (enablers, payoffs, fodder).
 * Used for shortlist relevance and package-completion scoring.
 */

function textMatches(text: string, patterns: (string | RegExp)[]): boolean {
  const t = text.toLowerCase();
  return patterns.some((p) =>
    typeof p === "string" ? t.includes(p.toLowerCase()) : p.test(t)
  );
}

/** True if the card fills the given package piece. */
export function cardFillsPackage(card: CardInfo, packageId: RequiredPackageId): boolean {
  const text = (card.oracleText ?? "").toLowerCase();
  const typeLine = (card.typeLine ?? "").toLowerCase();

  switch (packageId) {
    case "sac_outlets":
      return textMatches(text, [
        "sacrifice a creature",
        "sacrifice a permanent",
        "sacrifice another",
        "sacrifice target",
        "sacrifice X",
        /sacrifice\s+.*\s*:\s*\{/,
        "as an additional cost to cast",
        "you may sacrifice",
      ]);
    case "sac_fodder":
      return (
        typeLine.includes("creature") &&
        (textMatches(text, ["create", "token", "enters the battlefield"]) ||
          ((card.cmc ?? 0) <= 3 && typeLine.includes("creature")))
      );
    case "sac_payoffs":
      return textMatches(text, [
        "whenever a creature dies",
        "whenever you sacrifice",
        "whenever something dies",
        "lose life",
        "gain life",
        "deal damage",
        "draw a card",
        "whenever a creature leaves",
      ]);
    case "token_makers":
      return textMatches(text, [
        "create a ",
        "create that many",
        "create X ",
        "token",
        "tokens",
        "populate",
      ]);
    case "token_payoffs":
      return textMatches(text, [
        "whenever a token",
        "tokens you control",
        "for each token",
        "number of tokens",
        "creatures you control",
      ]);
    case "reanimate_targets":
      return (
        typeLine.includes("creature") &&
        (card.cmc ?? 0) >= 5 &&
        textMatches(text, ["enters the battlefield", "when ", "dies", "attack"])
      );
    case "reanimate_effects":
      return textMatches(text, [
        "return ",
        "from your graveyard",
        "from graveyard to",
        "put onto the battlefield from",
        "reanimate",
        "flashback",
      ]);
    case "discard_outlets":
      return textMatches(text, [
        "discard a card",
        "discard your hand",
        "discard X",
        "cycle",
        "loot",
        "rummage",
      ]);
    case "cheap_spells":
      return (
        (typeLine.includes("instant") || typeLine.includes("sorcery")) &&
        (card.cmc ?? 0) <= 2
      );
    case "spell_payoffs":
      return (
        (typeLine.includes("instant") || typeLine.includes("sorcery")) &&
        textMatches(text, [
          "whenever you cast",
          "instant or sorcery",
          "copy",
          "draw",
          "deal damage",
        ])
      );
    case "equipment_auras":
      return typeLine.includes("equipment") || typeLine.includes("aura");
    case "voltron_protection":
      return textMatches(text, [
        "hexproof",
        "indestructible",
        "ward",
        "can't be targeted",
        "shroud",
        "protection from",
      ]);
    case "ramp_density":
      return textMatches(text, [
        "add ",
        "mana",
        "search your library for a land",
        "put a land",
        "put onto the battlefield",
      ]);
    case "draw_engines":
      return textMatches(text, [
        "draw a card",
        "draw two",
        "draw X",
        "whenever you",
        "at the beginning of your",
      ]);
    default:
      return false;
  }
}

/** Which packages does this card fill? (can be multiple.) */
export function getPackagesFilledByCard(card: CardInfo): RequiredPackageId[] {
  const ids: RequiredPackageId[] = [
    "sac_outlets",
    "sac_fodder",
    "sac_payoffs",
    "token_makers",
    "token_payoffs",
    "reanimate_targets",
    "reanimate_effects",
    "discard_outlets",
    "cheap_spells",
    "spell_payoffs",
    "equipment_auras",
    "voltron_protection",
    "ramp_density",
    "draw_engines",
  ];
  return ids.filter((id) => cardFillsPackage(card, id));
}

/** Default min counts per package when plan.packageMinimums is not set for that package. */
const DEFAULT_PACKAGE_MINIMUMS: Record<RequiredPackageId, number> = {
  sac_outlets: 3,
  sac_fodder: 5,
  sac_payoffs: 4,
  token_makers: 6,
  token_payoffs: 4,
  reanimate_targets: 6,
  reanimate_effects: 4,
  discard_outlets: 3,
  cheap_spells: 15,
  spell_payoffs: 6,
  equipment_auras: 10,
  voltron_protection: 4,
  ramp_density: 0, // covered by role targets
  draw_engines: 0,
};

/**
 * Min counts per package for this plan. Uses plan.packageMinimums when set (from in-depth profile),
 * otherwise defaults per requiredPackages. Drives packageCompletionScore so we pick the best cards for the commander.
 */
export function getPackageTargets(plan: CommanderPlan): Partial<Record<RequiredPackageId, number>> {
  const targets: Partial<Record<RequiredPackageId, number>> = {};
  const planMins = plan.packageMinimums ?? {};
  for (const pkg of plan.requiredPackages) {
    const explicit = planMins[pkg];
    if (explicit != null && explicit > 0) {
      targets[pkg] = explicit;
    } else {
      const def = DEFAULT_PACKAGE_MINIMUMS[pkg];
      if (def > 0) targets[pkg] = def;
    }
  }
  return targets;
}

/** Maps win-condition target keys to package IDs that fulfill them (for extra emphasis when short). */
const WIN_CONDITION_TO_PACKAGES: Record<keyof WinConditionTargets, RequiredPackageId[]> = {
  drainPayoffs: ["sac_payoffs"],
  tokenMakers: ["token_makers"],
  tokenPayoffs: ["token_payoffs"],
  reanimateTargets: ["reanimate_targets"],
  reanimateEffects: ["reanimate_effects"],
  comboInteraction: [], // interaction is role-based, not package
};

function winConditionFulfillmentBoost(
  card: CardInfo,
  currentMainCardInfos: CardInfo[],
  plan: CommanderPlan
): number {
  const wct = plan.winConditionTargets;
  if (!wct) return 0;
  const filledByCard = getPackagesFilledByCard(card);
  let boost = 0;
  for (const [key, targetMin] of Object.entries(wct) as [keyof WinConditionTargets, number][]) {
    if (targetMin == null) continue;
    const pkgs = WIN_CONDITION_TO_PACKAGES[key];
    if (!pkgs?.length) continue;
    const currentCount = pkgs.reduce((sum, pkg) => {
      return sum + currentMainCardInfos.filter((c) => cardFillsPackage(c, pkg)).length;
    }, 0);
    if (currentCount >= targetMin) continue;
    const fillsThis = filledByCard.some((p) => pkgs.includes(p));
    if (fillsThis) boost += 0.25; // extra emphasis on filling primary win path
  }
  return boost;
}

/**
 * Score boost when adding this card helps complete a required package (and win-condition targets);
 * small penalty when that package is already satisfied.
 */
export function packageCompletionScore(
  card: CardInfo,
  currentMainCardInfos: CardInfo[],
  plan: CommanderPlan
): number {
  const targets = getPackageTargets(plan);
  const filledByCard = getPackagesFilledByCard(card);
  let score = 0;

  if (filledByCard.length > 0) {
    for (const pkg of filledByCard) {
      const target = targets[pkg];
      if (target == null) continue;
      const currentCount = currentMainCardInfos.filter((c) => cardFillsPackage(c, pkg)).length;
      if (currentCount < target) {
        const need = target - currentCount;
        score += 0.4 * Math.min(need, 2); // boost up to ~0.8 per package we're short on
      } else if (currentCount >= target + 2) {
        score -= 0.15; // small penalty for oversaturating
      }
    }
  }

  score += winConditionFulfillmentBoost(card, currentMainCardInfos, plan);
  return score;
}
