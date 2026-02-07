import type { CardInfo } from "./types";
import type { CommanderThemeId } from "./commanderThemes";
import { getCommanderThemes } from "./commanderThemes";

/**
 * CommanderPlan: structured plan for how a commander wants to win and what the deck needs.
 * Drives target ratios, package requirements, and scoring. Populated from the commander card
 * (oracle text, type line, themes) and optionally from data/overrides later.
 */

/** How the deck typically wins. */
export type WinConditionId =
  | "combat"       // beatdown, trample, evasive creatures
  | "commander_damage"  // 21 commander damage (voltron)
  | "drain"        // life drain (aristocrats, ping)
  | "combo"        // two-card or engine combo
  | "tokens_wide"  // many tokens attacking
  | "mill"         // deck the opponent
  | "alt_win";     // Thassa's Oracle, etc.

/** Key resources the deck cares about (graveyard, tokens, artifacts, etc.). */
export type KeyResourceId =
  | "graveyard"
  | "tokens"
  | "artifacts"
  | "enchantments"
  | "mana_dorks"
  | "permanent_density"
  | "spell_count"
  | "counters";

/** Required "subpackages" for the strategy (e.g. aristocrats needs outlets + fodder + payoffs). */
export type RequiredPackageId =
  | "sac_outlets"
  | "sac_fodder"
  | "sac_payoffs"
  | "token_makers"
  | "token_payoffs"
  | "reanimate_targets"
  | "reanimate_effects"
  | "discard_outlets"
  | "cheap_spells"
  | "spell_payoffs"
  | "equipment_auras"
  | "voltron_protection"
  | "ramp_density"
  | "draw_engines";

/** Tempo: how fast the deck aims to close the game. */
export type TempoId = "fast" | "medium" | "slow" | "variable";

/** Curve shape hint for nonlands. */
export type CurveShapeId = "low" | "mid" | "high" | "bimodal";

export interface CommanderPlan {
  /** Commander name (for debugging/logging). */
  commanderName: string;

  /** Primary game-plan tags (from theme detection). */
  primaryThemes: CommanderThemeId[];

  /** Tribes the commander cares about (e.g. dragon, angel, demon). Empty if not tribal. */
  preferredTribes: string[];

  /** Win conditions this commander typically supports. */
  winConditions: WinConditionId[];

  /** Key resources the deck needs to leverage. */
  keyResources: KeyResourceId[];

  /** Required subpackages: we want minimum counts of these (outlets, payoffs, fodder, etc.). */
  requiredPackages: RequiredPackageId[];

  /** Tempo expectation. */
  tempo: TempoId;

  /** Typical nonland curve shape. */
  curveShape: CurveShapeId;

  /** Target average CMC for nonlands (e.g. 2.5 for low, 3.2 for mid). */
  targetAvgCmc: number;

  /** Must-have mechanics (e.g. "permanent types" for Muldrotha, "self-mill"). */
  mustHaveMechanics: string[];

  /** True if commander cheats creatures onto the battlefield (Kaalia, etc.) → favor high-CMC payoff creatures. */
  commanderCheatsCreatures: boolean;

  /** True if commander reduces cost for tribe/spells → favor payoff density. */
  commanderReducesCost: boolean;

  /** Pip intensity: "low" | "medium" | "high" — affects fixing priority. */
  pipIntensity: "low" | "medium" | "high";
}

const CREATURE_SUBTYPES = new Set([
  "angel", "demon", "dragon", "vampire", "elf", "goblin", "wizard", "zombie", "soldier", "warrior",
  "rogue", "cleric", "knight", "sliver", "spirit", "human", "cat", "dinosaur", "beast", "elemental",
  "hydra", "bird", "devil", "horror", "nightmare", "phyrexian", "eldrazi", "myr", "construct",
  "artificer", "pirate", "ninja", "samurai", "scout", "shaman", "druid", "merfolk", "kraken",
  "serpent", "leviathan", "sphinx", "naga", "ally", "ooze", "plant", "fungus", "insect", "spider",
  "djinn", "efreet", "vedalken", "pilot", "rat", "wolf", "bear", "turtle", "crab",
]);

function getTribesFromTypeLine(typeLine: string | undefined): string[] {
  const line = (typeLine ?? "").toLowerCase();
  const dash = line.indexOf("—");
  const subtypePart = dash >= 0 ? line.slice(dash + 1) : line;
  const found: string[] = [];
  for (const subtype of CREATURE_SUBTYPES) {
    const re = new RegExp(`\\b${subtype}s?\\b`, "i");
    if (re.test(subtypePart)) found.push(subtype);
  }
  return found;
}

function getPreferredTribes(commander: CardInfo): string[] {
  const fromOracle: string[] = [];
  const raw = (commander.oracleText ?? "").toLowerCase();
  if (raw.trim()) {
    for (const subtype of CREATURE_SUBTYPES) {
      const re = new RegExp(`\\b${subtype}s?\\b`, "i");
      if (re.test(raw)) fromOracle.push(subtype);
    }
  }
  if (fromOracle.length > 0) return [...new Set(fromOracle)];
  return getTribesFromTypeLine(commander.typeLine);
}

function detectWinConditions(commander: CardInfo): WinConditionId[] {
  const text = (commander.oracleText ?? "").toLowerCase();
  const out: WinConditionId[] = [];
  if (/commander\s+damage|combat\s+damage.*player|trample|double\s+strike|equipped\s+creature|enchant\s+creature/.test(text))
    out.push("commander_damage");
  if (/whenever.*(die|dies)|sacrifice|drain|lose\s+life|gain\s+life|life\s+total/.test(text) || /blood\s+artist|purphoros|impact\s+tremors/i.test(text))
    out.push("drain");
  if (/create\s+.*token|token(s)?\s+enters|populate|double\s+token/.test(text))
    out.push("tokens_wide");
  if (/combo|infinite|whenever\s+you\s+cast.*copy|copy\s+target\s+spell/.test(text))
    out.push("combo");
  if (/mill|put\s+.*into\s+graveyard|draw\s+.*card.*lose/.test(text))
    out.push("mill");
  // Default: combat is almost always a fallback
  if (out.length === 0) out.push("combat");
  return [...new Set(out)];
}

function detectKeyResources(commander: CardInfo, themes: CommanderThemeId[]): KeyResourceId[] {
  const text = (commander.oracleText ?? "").toLowerCase();
  const out: KeyResourceId[] = [];
  if (themes.includes("graveyard") || /graveyard|dies|discard|mill/.test(text)) out.push("graveyard");
  if (themes.includes("tokens") || /token/.test(text)) out.push("tokens");
  if (themes.includes("artifacts") || /artifact/.test(text)) out.push("artifacts");
  if (themes.includes("enchantments") || /enchantment|aura/.test(text)) out.push("enchantments");
  if (themes.includes("spellslinger") || /instant|sorcery/.test(text)) out.push("spell_count");
  if (themes.includes("counters")) out.push("counters");
  if (/enters\s+the\s+battlefield|when.*enters/.test(text)) out.push("permanent_density");
  return [...new Set(out)];
}

function detectRequiredPackages(commander: CardInfo, themes: CommanderThemeId[]): RequiredPackageId[] {
  const out: RequiredPackageId[] = [];
  if (themes.includes("sacrifice")) {
    out.push("sac_outlets", "sac_fodder", "sac_payoffs");
  }
  if (themes.includes("tokens")) {
    out.push("token_makers", "token_payoffs");
  }
  if (themes.includes("graveyard")) {
    out.push("reanimate_targets", "reanimate_effects");
  }
  if (themes.includes("spellslinger")) {
    out.push("cheap_spells", "spell_payoffs");
  }
  if (themes.includes("voltron") || themes.includes("commander_damage")) {
    out.push("equipment_auras", "voltron_protection");
  }
  out.push("ramp_density", "draw_engines");
  return [...new Set(out)];
}

function detectTempo(commander: CardInfo, themes: CommanderThemeId[]): TempoId {
  const text = (commander.oracleText ?? "").toLowerCase();
  if (themes.includes("voltron") || /haste|commander\s+damage/.test(text)) return "fast";
  if (themes.includes("spellslinger") && /copy|storm/.test(text)) return "fast";
  if (themes.includes("sacrifice") || themes.includes("graveyard")) return "medium";
  if (themes.includes("counters") || /proliferate/.test(text)) return "slow";
  return "medium";
}

function detectCurveShape(commander: CardInfo, themes: CommanderThemeId[]): CurveShapeId {
  const text = (commander.oracleText ?? "").toLowerCase();
  if (themes.includes("spellslinger")) return "low";
  if (themes.includes("voltron")) return "mid";
  if (/put.*onto the battlefield|costs?\s+less|cheat/.test(text)) return "high"; // cheat big creatures
  if (themes.includes("tokens") || themes.includes("sacrifice")) return "mid";
  return "mid";
}

function detectTargetAvgCmc(curveShape: CurveShapeId): number {
  switch (curveShape) {
    case "low": return 2.2;
    case "mid": return 2.8;
    case "high": return 3.4;
    case "bimodal": return 2.9;
    default: return 2.8;
  }
}

function detectMustHaveMechanics(commander: CardInfo, themes: CommanderThemeId[]): string[] {
  const text = (commander.oracleText ?? "").toLowerCase();
  const out: string[] = [];
  if (themes.includes("graveyard") && /permanent|card types/.test(text)) out.push("permanent_density");
  if (/mill|dredge|whenever.*put.*graveyard/.test(text)) out.push("self_mill");
  if (themes.includes("voltron")) out.push("protection", "evasion");
  return out;
}

function commanderCheatsCreatures(commander: CardInfo): boolean {
  const text = (commander.oracleText ?? "").toLowerCase();
  return /put\s+(a|an|target)\s+.*onto the battlefield/.test(text) || /put.*onto the battlefield.*(creature|angel|demon|dragon|card)/.test(text);
}

function commanderReducesCost(commander: CardInfo): boolean {
  const text = (commander.oracleText ?? "").toLowerCase();
  return /costs?\s+\d+\s+less/.test(text) || /cost\s+less/.test(text) || /\d+\s+less\s+to\s+cast/.test(text);
}

function detectPipIntensity(commander: CardInfo): "low" | "medium" | "high" {
  const identity = commander.colorIdentity ?? [];
  if (identity.length >= 4) return "high";
  if (identity.length === 3) return "medium";
  return "low";
}

/**
 * Build a CommanderPlan from the commander card. Uses oracle text, type line, and
 * theme detection. Later we can add data-derived plans and rule-based overrides.
 */
export function getCommanderPlan(commander: CardInfo): CommanderPlan {
  const themes = getCommanderThemes(commander);
  const preferredTribes = getPreferredTribes(commander);
  const curveShape = detectCurveShape(commander, themes);

  return {
    commanderName: commander.name,
    primaryThemes: themes,
    preferredTribes,
    winConditions: detectWinConditions(commander),
    keyResources: detectKeyResources(commander, themes),
    requiredPackages: detectRequiredPackages(commander, themes),
    tempo: detectTempo(commander, themes),
    curveShape,
    targetAvgCmc: detectTargetAvgCmc(curveShape),
    mustHaveMechanics: detectMustHaveMechanics(commander, themes),
    commanderCheatsCreatures: commanderCheatsCreatures(commander),
    commanderReducesCost: commanderReducesCost(commander),
    pipIntensity: detectPipIntensity(commander),
  };
}
