import type { CardInfo, CardInDeck } from "./types";
import type { CommanderPlan } from "./commanderPlan";
import type { ProfileTargets } from "./profileTargets";
import type { RoleTargets } from "./scoring";
import type { CommanderThemeId } from "./commanderThemes";
import { assignRole } from "./roleAssignment";
import { roleFulfillmentBonus, interactionBaselineBoost } from "./scoring";
import { commanderSynergyScore } from "./commanderThemes";
import { packageCompletionScore } from "./packages";

/**
 * Phase 8.2: Upgrade path — score cards not in the deck by "impact" if added.
 * Used to suggest "Top N missing cards" from the same collection.
 */

export interface UpgradeSuggestion {
  name: string;
  impactScore: number;
  role?: string;
}

/**
 * Score how much impact adding this card would have on the deck (higher = better upgrade).
 * Uses role fulfillment, interaction baseline, synergy, and package completion.
 */
export function scoreCardImpact(
  card: CardInfo,
  currentMain: CardInDeck[],
  plan: CommanderPlan,
  profile: ProfileTargets,
  roleTargets: RoleTargets,
  commanderThemes: CommanderThemeId[],
  cardInfos: Map<string, CardInfo>
): number {
  const mainInfos = currentMain
    .map((c) => cardInfos.get(c.name.toLowerCase()))
    .filter(Boolean) as CardInfo[];
  return (
    roleFulfillmentBonus(card, currentMain, roleTargets) * 2 +
    interactionBaselineBoost(card, currentMain, profile.minInteractionTotal) * 1.5 +
    commanderSynergyScore(card, commanderThemes) * 0.4 +
    packageCompletionScore(card, mainInfos, plan) * 1.2
  );
}

/**
 * Rank candidate cards (not in deck) by impact score; return top N.
 */
export function rankUpgradeSuggestions(
  candidates: CardInfo[],
  currentMain: CardInDeck[],
  plan: CommanderPlan,
  profile: ProfileTargets,
  roleTargets: RoleTargets,
  commanderThemes: CommanderThemeId[],
  cardInfos: Map<string, CardInfo>,
  limit: number
): UpgradeSuggestion[] {
  const mainNames = new Set(currentMain.map((c) => c.name.toLowerCase()));
  const notInDeck = candidates.filter((c) => !mainNames.has(c.name.toLowerCase()));
  const scored = notInDeck.map((card) => ({
    name: card.name,
    impactScore: scoreCardImpact(
      card,
      currentMain,
      plan,
      profile,
      roleTargets,
      commanderThemes,
      cardInfos
    ),
    role: assignRole(card),
  }));
  scored.sort((a, b) => b.impactScore - a.impactScore);
  return scored.slice(0, limit).map(({ name, impactScore, role }) => ({
    name,
    impactScore: Math.round(impactScore * 100) / 100,
    role,
  }));
}
