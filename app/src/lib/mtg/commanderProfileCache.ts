import { prisma } from "@/lib/prisma";
import type { CommanderPlan } from "./commanderPlan";
import { getCommanderPlan } from "./commanderPlan";
import type { CardInfo } from "./types";

/**
 * Cache for pre-computed CommanderPlan so we don't re-analyze ~2,500 commanders on every build.
 * Profiles are built by scripts/build-commander-profiles.ts and read at build time.
 */

export async function getCachedPlan(oracleId: string): Promise<CommanderPlan | null> {
  const row = await prisma.commanderProfile.findUnique({
    where: { oracleId },
  });
  if (!row?.planJson) return null;
  try {
    return JSON.parse(row.planJson) as CommanderPlan;
  } catch {
    return null;
  }
}

export async function setCachedPlan(oracleId: string, plan: CommanderPlan): Promise<void> {
  await prisma.commanderProfile.upsert({
    where: { oracleId },
    create: { oracleId, planJson: JSON.stringify(plan) },
    update: { planJson: JSON.stringify(plan) },
  });
}

/**
 * Returns the commander plan from cache if available; otherwise computes it, caches it, and returns.
 * Use this in deck build, upgrade suggestions, and harness so repeated builds for the same commander are fast.
 */
export async function getCommanderPlanWithCache(commander: CardInfo): Promise<CommanderPlan> {
  const oracleId = commander.id ?? (commander as { oracleId?: string }).oracleId ?? "";
  if (oracleId) {
    const cached = await getCachedPlan(oracleId);
    if (cached) return cached;
  }
  const plan = getCommanderPlan(commander);
  if (oracleId) await setCachedPlan(oracleId, plan);
  return plan;
}
