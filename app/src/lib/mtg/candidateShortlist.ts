import type { CardInfo, CardRole, OwnedCard, RoleFamily } from "./types";
import type { CommanderPlan } from "./commanderPlan";
import { roleToFamily } from "./roleAssignment";
import { getPackagesFilledByCard } from "./packages";

export interface CandidateEntry {
  card: CardInfo;
  owned: OwnedCard;
  role: CardRole;
}

/**
 * Stage 1 filter: keep candidates that have a plausible role for this plan
 * or fill at least one required package. Optionally trim very high-CMC cards for fast tempo.
 */
export function buildShortlist(
  entries: CandidateEntry[],
  plan: CommanderPlan
): CandidateEntry[] {
  const requiredPackages = new Set(plan.requiredPackages);
  const familyNotOther = (role: CardRole) => roleToFamily(role) !== "other";

  return entries.filter((e) => {
    if (familyNotOther(e.role)) return true;
    const filled = getPackagesFilledByCard(e.card);
    if (filled.some((p) => requiredPackages.has(p))) return true;
    // Keep lands and utility-ish cards that might still help
    const family = roleToFamily(e.role);
    if (family === "land" || family === "utility") return true;
    // Drop only true "other" that don't fill any required package
    return false;
  });
}

/**
 * For fast-tempo plans, optionally exclude very high CMC non-payoff cards from the shortlist
 * so we don't waste slots on 7-drops. Kept conservative: only drop if CMC > 7 and not a payoff/synergy role.
 */
export function trimHighCmcForTempo(
  entries: CandidateEntry[],
  plan: CommanderPlan,
  maxCmcForNonPayoff: number = 7
): CandidateEntry[] {
  if (plan.tempo !== "fast") return entries;
  const payoffFamilies: RoleFamily[] = ["payoff", "synergy", "finisher"];
  return entries.filter((e) => {
    const cmc = e.card.cmc ?? 0;
    const family = roleToFamily(e.role);
    if (cmc <= maxCmcForNonPayoff) return true;
    if (payoffFamilies.includes(family)) return true;
    if (plan.commanderCheatsCreatures && (e.card.typeLine ?? "").toLowerCase().includes("creature")) return true;
    return false;
  });
}
