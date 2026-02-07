import type { CardInDeck, CardInfo, CardRole, RoleFamily } from "./types";
import type { CommanderPlan } from "./commanderPlan";
import type { ProfileTargets } from "./profileTargets";
import type { RoleTargets } from "./scoring";
import { countByRoleFamily, roleToFamily } from "./roleAssignment";
import { commanderSynergyScore } from "./commanderThemes";
import type { CommanderThemeId } from "./commanderThemes";

/**
 * Phase 5: Draft + improve cycles. Multi-objective deck score and swap-based improvement.
 */

const INTERACTION_FAMILIES: RoleFamily[] = ["removal", "sweeper", "interaction", "protection"];

/**
 * Hard constraints: 99 cards, color identity, land count in profile range.
 */
export function satisfiesHardConstraints(
  main: CardInDeck[],
  lands: CardInDeck[],
  _identity: string[],
  profile: ProfileTargets
): boolean {
  const total = main.length + lands.length;
  if (total !== 99) return false;
  if (lands.length < profile.targetLandsMin || lands.length > profile.targetLandsMax) return false;
  return true;
}

/**
 * Single scalar deck score (higher = better). Combines curve, role ratios, interaction baseline.
 */
export function deckScore(
  main: CardInDeck[],
  cardInfos: Map<string, CardInfo>,
  plan: CommanderPlan,
  profile: ProfileTargets,
  roleTargets: RoleTargets,
  commanderThemes: CommanderThemeId[]
): number {
  if (main.length === 0) return 0;

  const avgCmc =
    main.reduce((s, c) => s + (c.cmc ?? 0), 0) / main.length;
  const curvePenalty = Math.abs(avgCmc - profile.targetAvgCmc) * 0.5;
  const variance =
    main.reduce((s, c) => s + ((c.cmc ?? 0) - avgCmc) ** 2, 0) / main.length;
  const curveScore = Math.max(0, 2 - curvePenalty - variance * 0.1);

  const counts = countByRoleFamily(main);
  let roleScore = 0;
  for (const family of Object.keys(roleTargets) as RoleFamily[]) {
    const target = roleTargets[family];
    if (target == null) continue;
    const current = counts[family] ?? 0;
    const diff = Math.abs(current - target);
    roleScore += Math.max(0, 1 - diff * 0.08);
  }

  const interactionTotal = INTERACTION_FAMILIES.reduce(
    (s, f) => s + (counts[f] ?? 0),
    0
  );
  const interactionScore =
    interactionTotal >= profile.minInteractionTotal ? 1 : interactionTotal / profile.minInteractionTotal;

  const mainInfos = main
    .map((c) => cardInfos.get(c.name.toLowerCase()))
    .filter(Boolean) as CardInfo[];
  const synergyScore =
    mainInfos.length > 0
      ? mainInfos.reduce(
          (s, c) => s + commanderSynergyScore(c, commanderThemes),
          0
        ) / mainInfos.length
      : 0;

  return curveScore * 0.3 + roleScore * 0.35 + interactionScore * 0.25 + synergyScore * 0.1;
}

const IMPROVE_CYCLES = 5;
const SWAP_CANDIDATES_MAIN = 12;
const SWAP_CANDIDATES_POOL = 25;

export interface ImproveDeckParams {
  main: CardInDeck[];
  lands: CardInDeck[];
  candidatePool: Array<{ card: CardInfo; role: CardRole }>;
  used: Set<string>;
  cardInfos: Map<string, CardInfo>;
  plan: CommanderPlan;
  profile: ProfileTargets;
  roleTargets: RoleTargets;
  commanderThemes: CommanderThemeId[];
  scoreFn: (card: CardInfo, currentMain: CardInDeck[]) => number;
  onProgress?: (message: string) => void;
}

/**
 * Run N improvement cycles: try swapping a main-deck card with an unused pool card;
 * accept if deck score improves and constraints still hold.
 */
export function runImprovementCycles(params: ImproveDeckParams): {
  main: CardInDeck[];
  lands: CardInDeck[];
  improved: boolean;
} {
  const {
    main: initialMain,
    lands,
    candidatePool,
    used,
    cardInfos,
    plan,
    profile,
    roleTargets,
    commanderThemes,
    scoreFn,
    onProgress,
  } = params;

  let main = [...initialMain];
  const nonlandPool = candidatePool.filter(
    (e) => roleToFamily(e.role) !== "land" && !used.has(e.card.name.toLowerCase())
  );

  if (nonlandPool.length === 0) {
    return { main, lands, improved: false };
  }

  const mainSet = new Set(main.map((c) => c.name.toLowerCase()));
  const poolAvailable = nonlandPool.filter((e) => !mainSet.has(e.card.name.toLowerCase()));

  if (poolAvailable.length === 0) {
    return { main, lands, improved: false };
  }

  let totalImproved = false;
  for (let cycle = 0; cycle < IMPROVE_CYCLES; cycle++) {
    onProgress?.(`Optimizing deck (cycle ${cycle + 1}/${IMPROVE_CYCLES})…`);
    const currentScore = deckScore(
      main,
      cardInfos,
      plan,
      profile,
      roleTargets,
      commanderThemes
    );
    const mainSetThisCycle = new Set(main.map((c) => c.name.toLowerCase()));
    const poolThisCycle = poolAvailable.filter(
      (e) => !mainSetThisCycle.has(e.card.name.toLowerCase())
    );

    const mainIndices = main
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5)
      .slice(0, SWAP_CANDIDATES_MAIN);

    let bestNewMain: CardInDeck[] | null = null;
    let bestScore = currentScore;

    for (const outIdx of mainIndices) {
      const mainWithout = main.filter((_, i) => i !== outIdx);
      const poolSorted = [...poolThisCycle].sort((a, b) => {
        const sa = scoreFn(a.card, mainWithout);
        const sb = scoreFn(b.card, mainWithout);
        return sb - sa;
      });

      for (let p = 0; p < Math.min(SWAP_CANDIDATES_POOL, poolSorted.length); p++) {
        const inEntry = poolSorted[p]!;
        if (mainSetThisCycle.has(inEntry.card.name.toLowerCase())) continue;
        const candidateMain: CardInDeck[] = [
          ...mainWithout,
          {
            name: inEntry.card.name,
            quantity: 1,
            role: inEntry.role,
            cmc: inEntry.card.cmc,
            typeLine: inEntry.card.typeLine,
            imageUrl: inEntry.card.imageUrl,
          },
        ];
        const score = deckScore(
          candidateMain,
          cardInfos,
          plan,
          profile,
          roleTargets,
          commanderThemes
        );
        if (score > bestScore && satisfiesHardConstraints(candidateMain, lands, [], profile)) {
          bestScore = score;
          bestNewMain = candidateMain;
        }
      }
    }

    if (bestNewMain != null && bestScore > currentScore) {
      main = bestNewMain;
      totalImproved = true;
    }
  }

  return { main, lands, improved: totalImproved };
}
