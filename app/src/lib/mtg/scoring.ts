import type { CardInfo, CardInDeck, CardRole, RoleFamily } from "./types";
import { assignRole, countByRoleFamily, roleToFamily } from "./roleAssignment";

/**
 * Contextual scoring for Phase 3: marginal value relative to current deck state.
 * - Role fulfillment: boost when deck is short on a role, penalize when saturated.
 * - CMC clumping: penalize adding another card at a CMC we already have many of.
 * - Interaction baseline: boost interaction-family cards when below minimum.
 */

export type RoleTargets = Partial<Record<RoleFamily, number>>;

/**
 * Bonus when the deck is short on this card's role family (so we prefer filling gaps).
 * Penalty when we're at or over target for that family (avoid stacking one role).
 */
export function roleFulfillmentBonus(
  card: CardInfo,
  currentMain: CardInDeck[],
  targets: RoleTargets
): number {
  const role = assignRole(card);
  const family = roleToFamily(role);
  const target = targets[family];
  if (target == null || target <= 0) return 0;
  const counts = countByRoleFamily(currentMain);
  const current = counts[family] ?? 0;
  if (current < target) {
    const need = target - current;
    return Math.min(0.5, need * 0.08); // boost up to 0.5 when 1–2 short
  }
  if (current > target) {
    const over = current - target;
    return -Math.min(0.3, over * 0.06); // small penalty when over target
  }
  return 0;
}

/** CMC bands we care about for clumping (same CMC = same band). */
const CMC_CLUMP_THRESHOLD = 4;

/**
 * Penalize adding a card at a CMC where we already have many cards (spread the curve).
 */
export function cmcClumpPenalty(card: CardInfo, currentMain: CardInDeck[]): number {
  const cmc = typeof card.cmc === "number" ? card.cmc : 0;
  const atCmc = currentMain.filter((c) => (c.cmc ?? 0) === cmc).length;
  if (atCmc < CMC_CLUMP_THRESHOLD) return 0;
  return -0.05 * (atCmc - CMC_CLUMP_THRESHOLD + 1); // -0.05 per card over threshold
}

/** Role families that count as "interaction" for the baseline (removal, sweepers, counters, protection). */
const INTERACTION_FAMILIES: RoleFamily[] = ["removal", "sweeper", "interaction", "protection"];

/**
 * Boost for cards in interaction families when the deck is below the interaction minimum.
 * Ensures we consistently meet interaction baseline.
 */
export function interactionBaselineBoost(
  card: CardInfo,
  currentMain: CardInDeck[],
  minInteraction: number
): number {
  const counts = countByRoleFamily(currentMain);
  const total =
    (counts.removal ?? 0) +
    (counts.sweeper ?? 0) +
    (counts.interaction ?? 0) +
    (counts.protection ?? 0);
  if (total >= minInteraction) return 0;
  const role = assignRole(card);
  const family = roleToFamily(role);
  if (!INTERACTION_FAMILIES.includes(family)) return 0;
  const need = minInteraction - total;
  return Math.min(0.8, need * 0.15); // stronger boost the more we're short
}
