import type { BuilderOptions, DeckArchetype } from "./types";
import type { CommanderPlan } from "./commanderPlan";

/**
 * Phase 4.1–4.2: Target profile (power, meta, playstyle) → plan and role ratios.
 * Returns all numeric targets the engine uses; archetype + profile adjust plan defaults.
 */

export interface ProfileTargets {
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
  targetAvgCmc: number;
  maxAvgCmc: number;
}

const ARCHETYPE_DEFAULTS: Record<
  DeckArchetype,
  Partial<ProfileTargets> & { minInteractionTotal?: number }
> = {
  balanced: {},
  tribal: {},
  spellslinger: { targetDraw: 14 },
  voltron: { targetFinisher: 6 },
  control: {
    targetRemoval: 15,
    targetDraw: 13,
    targetSweeper: 6,
    minInteractionTotal: 14,
  },
};

const POWER_ADJUST: Record<
  NonNullable<BuilderOptions["power"]>,
  Partial<ProfileTargets>
> = {
  precon: {
    targetRamp: 11,
    targetDraw: 10,
    targetRemoval: 8,
    targetInteraction: 4,
    targetSweeper: 3,
    minInteractionTotal: 8,
    targetLandsMin: 37,
    targetLandsMax: 40,
    targetAvgCmc: 3.0,
    maxAvgCmc: 3.8,
  },
  upgraded: {},
  high_power: {
    targetRamp: 13,
    targetDraw: 12,
    targetRemoval: 12,
    targetInteraction: 8,
    targetSweeper: 5,
    minInteractionTotal: 12,
    targetLandsMin: 34,
    targetLandsMax: 37,
    targetAvgCmc: 2.4,
    maxAvgCmc: 3.2,
  },
  cedh: {
    targetRamp: 14,
    targetDraw: 14,
    targetRemoval: 12,
    targetInteraction: 10,
    targetSweeper: 4,
    minInteractionTotal: 14,
    targetLandsMin: 32,
    targetLandsMax: 35,
    targetAvgCmc: 2.0,
    maxAvgCmc: 2.8,
  },
};

function applyOverrides<T extends Record<string, number>>(
  base: T,
  overrides: Partial<T>
): T {
  const out = { ...base };
  for (const k of Object.keys(overrides) as (keyof T)[]) {
    if (overrides[k] != null) (out as Partial<T>)[k] = overrides[k] as T[keyof T];
  }
  return out;
}

/**
 * Compute role and land targets from commander plan + builder options (archetype, power, meta, playstyle).
 */
export function getProfileTargets(
  plan: CommanderPlan,
  options: BuilderOptions
): ProfileTargets {
  const archetype = options.archetype ?? "balanced";
  const power = options.power ?? "upgraded";
  const base: ProfileTargets = {
    targetRamp: 12,
    targetDraw: 11,
    targetRemoval: 10,
    targetInteraction: 6,
    targetSweeper: 4,
    targetFinisher: 4,
    targetThemeSynergy: 25,
    minInteractionTotal: 10,
    targetLandsMin: 34,
    targetLandsMax: 38,
    targetAvgCmc: plan.targetAvgCmc,
    maxAvgCmc: Math.min(3.5, plan.targetAvgCmc + 0.8),
  };

  let result = applyOverrides(base, ARCHETYPE_DEFAULTS[archetype]);
  result = applyOverrides(result, POWER_ADJUST[power]);

  // Meta: combo wants more stack interaction; graveyard wants more grave hate (we don't have a separate "grave hate" count, so we bump removal)
  if (options.meta === "combo") {
    result = applyOverrides(result, {
      targetInteraction: Math.max(result.targetInteraction, 8),
      minInteractionTotal: Math.max(result.minInteractionTotal, 12),
    });
  }
  if (options.meta === "graveyard") {
    result = applyOverrides(result, {
      targetRemoval: Math.max(result.targetRemoval, 12),
      minInteractionTotal: Math.max(result.minInteractionTotal, 11),
    });
  }

  // Playstyle: stax_lite wants more interaction; battlecruiser slightly higher curve
  if (options.playstyle === "stax_lite") {
    result = applyOverrides(result, {
      targetInteraction: Math.max(result.targetInteraction, 8),
      minInteractionTotal: Math.max(result.minInteractionTotal, 12),
    });
  }
  if (options.playstyle === "battlecruiser") {
    result = applyOverrides(result, {
      targetAvgCmc: Math.min(3.4, result.targetAvgCmc + 0.4),
      maxAvgCmc: Math.min(4.0, result.maxAvgCmc + 0.4),
    });
  }

  // Commander plan overrides: ensure we meet what this commander's game plan needs (take max so we never go below).
  const planOverrides = plan.roleTargetOverrides;
  if (planOverrides) {
    if (planOverrides.targetRamp != null) result.targetRamp = Math.max(result.targetRamp, planOverrides.targetRamp);
    if (planOverrides.targetDraw != null) result.targetDraw = Math.max(result.targetDraw, planOverrides.targetDraw);
    if (planOverrides.targetRemoval != null) result.targetRemoval = Math.max(result.targetRemoval, planOverrides.targetRemoval);
    if (planOverrides.targetInteraction != null) result.targetInteraction = Math.max(result.targetInteraction, planOverrides.targetInteraction);
    if (planOverrides.targetSweeper != null) result.targetSweeper = Math.max(result.targetSweeper, planOverrides.targetSweeper);
    if (planOverrides.targetFinisher != null) result.targetFinisher = Math.max(result.targetFinisher, planOverrides.targetFinisher);
    if (planOverrides.targetThemeSynergy != null) result.targetThemeSynergy = Math.max(result.targetThemeSynergy, planOverrides.targetThemeSynergy);
    if (planOverrides.minInteractionTotal != null) result.minInteractionTotal = Math.max(result.minInteractionTotal, planOverrides.minInteractionTotal);
    if (planOverrides.targetLandsMin != null) result.targetLandsMin = Math.max(result.targetLandsMin, planOverrides.targetLandsMin);
    if (planOverrides.targetLandsMax != null) result.targetLandsMax = Math.min(result.targetLandsMax, planOverrides.targetLandsMax);
  }

  return result;
}
