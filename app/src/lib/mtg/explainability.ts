import type { CardInDeck, CardInfo, CardRole, RoleFamily } from "./types";
import type { CommanderPlan } from "./commanderPlan";
import type { RoleTargets } from "./scoring";
import type { CommanderThemeId } from "./commanderThemes";
import { roleToFamily } from "./roleAssignment";
import { countByRoleFamily } from "./roleAssignment";
import { getPackagesFilledByCard } from "./packages";
import { commanderSynergyScore } from "./commanderThemes";

/**
 * Phase 6: Explainability — short, human-readable reason for each card in the deck.
 */

const ROLE_LABELS: Partial<Record<CardRole | RoleFamily, string>> = {
  ramp: "Ramp",
  ramp_land: "Ramp (land)",
  ramp_permanent: "Ramp (permanent)",
  draw: "Draw",
  draw_burst: "Draw",
  draw_engine: "Draw engine",
  removal: "Removal",
  removal_single: "Removal",
  removal_wipe: "Board wipe",
  sweeper: "Sweeper",
  interaction: "Interaction (counters/protection)",
  enabler: "Enabler",
  payoff: "Payoff",
  finisher: "Finisher",
  wincon: "Win condition",
  fixing: "Mana fixing",
  protection: "Protection",
  recursion: "Recursion",
  tutor: "Tutor",
  utility: "Utility",
  synergy: "Synergy",
  land: "Land",
  other: "Other",
};

const PACKAGE_LABELS: Record<string, string> = {
  sac_outlets: "sacrifice outlet",
  sac_fodder: "sacrifice fodder",
  sac_payoffs: "sacrifice payoff",
  token_makers: "token maker",
  token_payoffs: "token payoff",
  reanimate_targets: "reanimation target",
  reanimate_effects: "reanimation",
  cheap_spells: "cheap spell",
  spell_payoffs: "spell payoff",
  equipment_auras: "equipment/aura",
  voltron_protection: "voltron protection",
  ramp_density: "ramp",
  draw_engines: "draw engine",
};

function roleLabel(role: CardRole | RoleFamily): string {
  return ROLE_LABELS[role] ?? (typeof role === "string" ? role.replace(/_/g, " ") : "Card");
}

/**
 * Build a short reason string for a nonland card in the deck.
 */
export function explainPick(
  card: CardInDeck,
  cardInfo: CardInfo | undefined,
  main: CardInDeck[],
  plan: CommanderPlan,
  roleTargets: RoleTargets,
  commanderThemes: CommanderThemeId[]
): string {
  const role = (card.role ?? "other") as CardRole;
  const family = roleToFamily(role);
  const parts: string[] = [];

  parts.push(roleLabel(role));
  if (card.cmc != null && typeof card.cmc === "number") {
    parts.push(`CMC ${card.cmc}`);
  }

  const counts = countByRoleFamily(main);
  const target = roleTargets[family];
  if (target != null && target > 0) {
    const current = counts[family] ?? 0;
    if (current <= target) {
      parts.push(`fills ${roleLabel(family).toLowerCase()} slot (target ${target})`);
    }
  }

  if (cardInfo) {
    const packages = getPackagesFilledByCard(cardInfo);
    const planPackages = new Set(plan.requiredPackages);
    const relevant = packages.filter((p) => planPackages.has(p));
    if (relevant.length > 0) {
      const labels = relevant.map((p) => PACKAGE_LABELS[p] ?? p).slice(0, 2);
      parts.push(`completes ${labels.join(" / ")}`);
    }
    const synergy = commanderSynergyScore(cardInfo, commanderThemes);
    if (synergy > 0.3) {
      parts.push("synergy with commander");
    }
  }

  return parts.join(". ");
}

/**
 * Build a short reason string for a land in the deck.
 */
export function explainLand(
  card: CardInDeck,
  cardInfo: CardInfo | undefined,
  identity: string[]
): string {
  if (!cardInfo) return "Land.";
  const typeLine = (cardInfo.typeLine ?? "").toLowerCase();
  if (typeLine.includes("basic") || ["plains", "island", "swamp", "mountain", "forest"].some((b) => card.name.toLowerCase().includes(b))) {
    return "Basic land.";
  }
  const text = (cardInfo.oracleText ?? "").toLowerCase();
  const producesAny = /any color|mana of any type|add one mana of any/.test(text);
  if (producesAny) return "Land. Fixing (any color).";
  const colors: string[] = [];
  if (/\{w\}/.test(text) || /add\s+w\b/.test(text)) colors.push("W");
  if (/\{u\}/.test(text) || /add\s+u\b/.test(text)) colors.push("U");
  if (/\{b\}/.test(text) || /add\s+b\b/.test(text)) colors.push("B");
  if (/\{r\}/.test(text) || /add\s+r\b/.test(text)) colors.push("R");
  if (/\{g\}/.test(text) || /add\s+g\b/.test(text)) colors.push("G");
  const inIdentity = colors.filter((c) => identity.includes(c));
  if (inIdentity.length > 0) {
    return `Land. Fixing for ${inIdentity.join("/")}.`;
  }
  return "Land.";
}
