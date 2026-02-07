import type { CardInfo } from "./types";
import type { CardRole, RoleFamily } from "./types";

/**
 * Richer role assignment and role families for ratio targets.
 * Phase 1.2: assign one primary role per card (with variants); roleToFamily for aggregation.
 */

const RAMP_LAND = [
  "search your library for a basic",
  "search your library for a land",
  "put a land card",
  "put onto the battlefield tapped",
];
const RAMP_PERMANENT = ["add {", "add one mana", "add two mana", "additional mana", "mana of any"];
const RAMP_RITUAL = ["add ", "mana of any color", "tapped" ]; // one-shot mana
const DRAW_BURST = ["draw a card", "draw two", "draw three", "draw X"];
const DRAW_ENGINE = ["whenever you", "draw a card", "at the beginning of your"];
const REMOVAL_SINGLE = ["destroy target", "exile target", "deal damage to target"];
const REMOVAL_WIPE = ["destroy all", "exile all", "each creature", "each nonland"];
const SWEEPER = ["destroy all", "exile all", "each creature", "each nonland"];
const FINISHER = ["trample", "flying", "haste", "double strike", "whenever ~ attacks"];
const ENABLER_SAC = ["sacrifice", "sacrifice a ", "as an additional cost"];
const PAYOFF_SAC = ["whenever", "dies", "sacrificed", "lose life", "gain life"];
const TOKEN_MAKER = ["create ", "token", "tokens"];
const COUNTERSPELL = ["counter target", "counter spell"];
const PROTECTION = ["hexproof", "indestructible", "ward", "can't be targeted", "shroud"];
const TUTOR = ["search your library", "search your deck"];
const RECURSION = ["return ", "from your graveyard", "from graveyard to hand", "flashback"];

function textIncludes(text: string, phrases: string[]): boolean {
  const t = text.toLowerCase();
  return phrases.some((p) => t.includes(p.toLowerCase()));
}

/**
 * Assign the most specific role we can detect. Falls back to generic role (ramp, draw, etc.)
 * when we can't distinguish the variant.
 */
export function assignRole(card: CardInfo): CardRole {
  const text = (card.oracleText ?? "").toLowerCase();
  const typeLine = (card.typeLine ?? "").toLowerCase();
  if (typeLine.includes("land")) return "land";

  // Ramp variants
  if (textIncludes(text, RAMP_LAND)) return "ramp_land";
  if (textIncludes(text, RAMP_PERMANENT)) return "ramp_permanent";
  if (textIncludes(text, ["ritual", "dark ritual", "seething song"]) || (text.includes("add ") && text.includes("mana") && !text.includes("permanent"))) return "ramp_ritual";
  if (textIncludes(text, ["add ", "mana"])) return "ramp_burst";

  // Draw variants
  if (textIncludes(text, DRAW_ENGINE) && (text.includes("draw") || text.includes("card"))) return "draw_engine";
  if (textIncludes(text, ["draw a card", "draw two", "draw three", "draw X", "draw cards"])) return "draw_burst";
  if (text.includes("draw") && text.includes("card")) return "draw_conditional";

  // Removal / sweeper
  if (textIncludes(text, SWEEPER) && textIncludes(text, ["destroy", "exile", "damage"])) return "sweeper";
  if (textIncludes(text, REMOVAL_WIPE)) return "removal_wipe";
  if (textIncludes(text, REMOVAL_SINGLE)) return "removal_single";
  if (textIncludes(text, ["destroy", "exile", "deal damage"])) return "removal_flexible";

  // Interaction
  if (textIncludes(text, COUNTERSPELL)) return "interaction";
  if (textIncludes(text, PROTECTION)) return "protection";

  // Tutor / recursion
  if (textIncludes(text, TUTOR)) return "tutor";
  if (textIncludes(text, RECURSION)) return "recursion";

  // Enabler vs payoff (sacrifice / tokens)
  if (textIncludes(text, ENABLER_SAC) && !textIncludes(text, PAYOFF_SAC)) return "enabler";
  if (textIncludes(text, PAYOFF_SAC) && (text.includes("lose life") || text.includes("gain life") || text.includes("damage"))) return "payoff";
  if (textIncludes(text, TOKEN_MAKER)) return "enabler"; // token maker is enabler

  // Finisher / wincon
  if (textIncludes(text, FINISHER) && (typeLine.includes("creature") || typeLine.includes("planeswalker"))) return "finisher";
  if (text.includes("win the game") || text.includes("you win")) return "wincon";

  // Mana fixing (nonland)
  if (text.includes("mana of any color") || text.includes("any color of mana")) return "fixing";

  // Default by type
  if (typeLine.includes("creature") || typeLine.includes("planeswalker")) return "synergy";
  return "utility";
}

/**
 * Map a granular CardRole to its RoleFamily for ratio targets (e.g. ramp_land + ramp_permanent → ramp).
 */
export function roleToFamily(role: CardRole): RoleFamily {
  switch (role) {
    case "ramp":
    case "ramp_land":
    case "ramp_permanent":
    case "ramp_ritual":
    case "ramp_burst":
      return "ramp";
    case "draw":
    case "draw_burst":
    case "draw_engine":
    case "draw_conditional":
      return "draw";
    case "removal":
    case "removal_single":
    case "removal_wipe":
    case "removal_flexible":
      return "removal";
    case "sweeper":
      return "sweeper";
    case "interaction":
      return "interaction";
    case "enabler":
      return "enabler";
    case "payoff":
      return "payoff";
    case "finisher":
    case "wincon":
      return "finisher";
    case "fixing":
      return "fixing";
    case "protection":
      return "protection";
    case "recursion":
      return "recursion";
    case "tutor":
      return "tutor";
    case "utility":
      return "utility";
    case "synergy":
      return "synergy";
    case "land":
      return "land";
    default:
      return "other";
  }
}

/**
 * Count cards in main deck by role family (for ratio checks).
 */
export function countByRoleFamily(
  main: Array<{ role?: CardRole }>
): Partial<Record<RoleFamily, number>> {
  const counts: Partial<Record<RoleFamily, number>> = {};
  for (const c of main) {
    const family = roleToFamily((c.role ?? "other") as CardRole);
    counts[family] = (counts[family] ?? 0) + 1;
  }
  return counts;
}
