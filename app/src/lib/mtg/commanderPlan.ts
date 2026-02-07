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

/**
 * Commander-derived overrides for role targets. Applied in getProfileTargets so the deck
 * meets what this commander's game plan needs (e.g. spellslinger → more draw, voltron → more finishers).
 */
export type PlanRoleOverrides = Partial<{
  targetRamp: number;
  targetDraw: number;
  targetRemoval: number;
  targetInteraction: number;
  targetSweeper: number;
  targetFinisher: number;
  targetThemeSynergy: number;
  minInteractionTotal: number;
  targetLandsMin: number;
  targetLandsMax: number;
}>;

/**
 * Explicit minimum card counts per strategy package. When set, the builder prioritizes
 * filling these before generic slots. Theme- and win-condition-aware (e.g. sacrifice → higher sac counts).
 */
export type PackageMinimums = Partial<Record<RequiredPackageId, number>>;

/**
 * Win-condition-specific card targets. Ensures we have enough payoffs for the primary win path.
 */
export type WinConditionTargets = Partial<{
  /** Min drain/life-loss payoffs (aristocrats, ping). */
  drainPayoffs: number;
  /** Min token producers. */
  tokenMakers: number;
  /** Min token payoffs (anthems, "creatures you control"). */
  tokenPayoffs: number;
  /** Min reanimation targets (big creatures). */
  reanimateTargets: number;
  /** Min reanimation effects. */
  reanimateEffects: number;
  /** Min stack interaction / combo enablers. */
  comboInteraction: number;
}>;

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

  /**
   * Commander-specific role targets. Merged in getProfileTargets (we take max with base so plan needs are met).
   */
  roleTargetOverrides?: PlanRoleOverrides;

  /**
   * Explicit minimum counts per required package. Used by packageCompletionScore so we pick the best cards for the plan.
   */
  packageMinimums?: PackageMinimums;

  /**
   * Win-condition card targets. Ensures enough payoffs for primary win path (drain, tokens, reanimator, combo).
   */
  winConditionTargets?: WinConditionTargets;
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

/** Commander-specific role targets from themes and win conditions. */
function detectRoleTargetOverrides(
  _commander: CardInfo,
  themes: CommanderThemeId[],
  winConditions: WinConditionId[]
): PlanRoleOverrides {
  const overrides: PlanRoleOverrides = {};
  if (themes.includes("spellslinger")) {
    overrides.targetDraw = 13;
    overrides.targetThemeSynergy = 28; // more slots for instants/sorceries
  }
  if (themes.includes("voltron")) {
    overrides.targetFinisher = 6;
    overrides.targetThemeSynergy = 22; // equipment/auras
  }
  if (themes.includes("tokens")) {
    overrides.targetThemeSynergy = 28; // token makers + payoffs
  }
  if (themes.includes("sacrifice") || winConditions.includes("drain")) {
    overrides.targetThemeSynergy = 26; // outlets + fodder + payoffs
  }
  if (themes.includes("graveyard")) {
    overrides.targetDraw = 12; // looting/self-mill + draw
  }
  if (themes.includes("counters")) {
    overrides.targetThemeSynergy = 26; // +1/+1 and proliferate
  }
  if (winConditions.includes("combo")) {
    overrides.targetInteraction = 8;
    overrides.minInteractionTotal = 12;
  }
  if (themes.includes("landfall")) {
    overrides.targetRamp = 14; // landfall wants more land drops
  }
  return overrides;
}

/** Theme- and win-condition-aware package minimums. */
function detectPackageMinimums(
  themes: CommanderThemeId[],
  requiredPackages: RequiredPackageId[],
  winConditions: WinConditionId[]
): PackageMinimums {
  const min: PackageMinimums = {};
  for (const pkg of requiredPackages) {
    switch (pkg) {
      case "sac_outlets":
        min.sac_outlets = themes.includes("sacrifice") || winConditions.includes("drain") ? 4 : 3;
        break;
      case "sac_fodder":
        min.sac_fodder = themes.includes("sacrifice") ? 6 : 5;
        break;
      case "sac_payoffs":
        min.sac_payoffs = winConditions.includes("drain") ? 5 : 4;
        break;
      case "token_makers":
        min.token_makers = themes.includes("tokens") || winConditions.includes("tokens_wide") ? 8 : 6;
        break;
      case "token_payoffs":
        min.token_payoffs = themes.includes("tokens") ? 5 : 4;
        break;
      case "reanimate_targets":
        min.reanimate_targets = themes.includes("graveyard") ? 7 : 6;
        break;
      case "reanimate_effects":
        min.reanimate_effects = themes.includes("graveyard") ? 5 : 4;
        break;
      case "discard_outlets":
        min.discard_outlets = 3;
        break;
      case "cheap_spells":
        min.cheap_spells = themes.includes("spellslinger") ? 18 : 15;
        break;
      case "spell_payoffs":
        min.spell_payoffs = themes.includes("spellslinger") ? 8 : 6;
        break;
      case "equipment_auras":
        min.equipment_auras = themes.includes("voltron") ? 12 : 10;
        break;
      case "voltron_protection":
        min.voltron_protection = themes.includes("voltron") ? 5 : 4;
        break;
      default:
        break;
    }
  }
  return min;
}

/** Win-condition-specific card targets so we have enough payoffs for the primary win path. */
function detectWinConditionTargets(
  winConditions: WinConditionId[],
  themes: CommanderThemeId[]
): WinConditionTargets {
  const t: WinConditionTargets = {};
  if (winConditions.includes("drain") || themes.includes("sacrifice")) {
    t.drainPayoffs = 5;
  }
  if (winConditions.includes("tokens_wide") || themes.includes("tokens")) {
    t.tokenMakers = 8;
    t.tokenPayoffs = 5;
  }
  if (themes.includes("graveyard")) {
    t.reanimateTargets = 7;
    t.reanimateEffects = 5;
  }
  if (winConditions.includes("combo") || themes.includes("spellslinger")) {
    t.comboInteraction = 10; // counters + tutors + card draw
  }
  return t;
}

/**
 * Build a CommanderPlan from the commander card. Uses oracle text, type line, and
 * theme detection. Includes role overrides, package minimums, and win-condition targets
 * so the builder picks the best cards for this commander's game plan.
 */
export function getCommanderPlan(commander: CardInfo): CommanderPlan {
  const themes = getCommanderThemes(commander);
  const preferredTribes = getPreferredTribes(commander);
  const curveShape = detectCurveShape(commander, themes);
  const winConditions = detectWinConditions(commander);
  const requiredPackages = detectRequiredPackages(commander, themes);

  return {
    commanderName: commander.name,
    primaryThemes: themes,
    preferredTribes,
    winConditions,
    keyResources: detectKeyResources(commander, themes),
    requiredPackages,
    tempo: detectTempo(commander, themes),
    curveShape,
    targetAvgCmc: detectTargetAvgCmc(curveShape),
    mustHaveMechanics: detectMustHaveMechanics(commander, themes),
    commanderCheatsCreatures: commanderCheatsCreatures(commander),
    commanderReducesCost: commanderReducesCost(commander),
    pipIntensity: detectPipIntensity(commander),
    roleTargetOverrides: detectRoleTargetOverrides(commander, themes, winConditions),
    packageMinimums: detectPackageMinimums(themes, requiredPackages, winConditions),
    winConditionTargets: detectWinConditionTargets(winConditions, themes),
  };
}
