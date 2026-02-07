import { describe, expect, it } from "vitest";
import {
  runHarness,
  computeDeckMetrics,
  REFERENCE_COMMANDERS,
  type DeckMetrics,
} from "./evaluationHarness";
import type { CardInfo, DeckList } from "./types";
import { getCommanderPlan } from "./commanderPlan";
import { getProfileTargets } from "./profileTargets";

describe("evaluationHarness", () => {
  it("runHarness builds a deck for each reference commander and returns metrics", async () => {
    const results = await runHarness();
    expect(results.length).toBe(REFERENCE_COMMANDERS.length);
    for (const r of results) {
      expect(r.success).toBe(true);
      expect(r.error).toBeUndefined();
      expect(r.totalCards).toBeGreaterThanOrEqual(75);
      expect(r.totalCards).toBeLessThanOrEqual(99);
      expect(r.metrics).toBeDefined();
      expect(r.metrics!.compositeScore).toBeGreaterThan(0);
      expect(r.metrics!.interactionCoverage).toBeGreaterThanOrEqual(0);
      expect(r.metrics!.landCount).toBeGreaterThanOrEqual(30);
      expect(r.metrics!.landCount).toBeLessThanOrEqual(42);
    }
  }, 90000);

  it("computeDeckMetrics returns all metric fields", () => {
    const cardInfos = new Map<string, CardInfo>();
    const deckList: DeckList = {
      commander: { name: "Test", quantity: 1 },
      main: [],
      lands: Array.from({ length: 36 }, (_, i) => ({
        name: `Land ${i}`,
        quantity: 1,
        role: "land",
      })),
      stats: {
        totalNonlands: 0,
        totalLands: 36,
        byRole: {},
        colorIdentity: ["W", "U", "B", "G"],
      },
      legalityEnforced: true,
    };
    for (let i = 0; i < 63; i++) {
      deckList.main.push({
        name: `Spell ${i}`,
        quantity: 1,
        role: "synergy",
        cmc: 2 + (i % 3),
      });
    }
    const commanderInfo: CardInfo = {
      id: "test",
      name: "Test",
      cmc: 4,
      colors: ["W", "U", "B", "G"],
      colorIdentity: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature",
      types: ["Creature"],
    };
    cardInfos.set("test", commanderInfo);
    deckList.main.forEach((c) => {
      cardInfos.set(c.name.toLowerCase(), {
        id: c.name.toLowerCase(),
        name: c.name,
        cmc: c.cmc ?? 0,
        colors: [],
        colorIdentity: ["W", "U", "B", "G"],
        typeLine: "Creature",
        types: ["Creature"],
      });
    });
    const plan = getCommanderPlan(commanderInfo);
    const profile = getProfileTargets(plan, { enforceLegality: true });
    const metrics = computeDeckMetrics(deckList, cardInfos, plan, profile);
    expect(metrics.avgCmc).toBeGreaterThan(0);
    expect(metrics.curveScore).toBeGreaterThanOrEqual(0);
    expect(metrics.roleRatioScore).toBeGreaterThanOrEqual(0);
    expect(metrics.synergyDensity).toBeGreaterThanOrEqual(0);
    expect(metrics.landCount).toBe(36);
    expect(metrics.interactionCoverage).toBeGreaterThanOrEqual(0);
    expect(metrics.compositeScore).toBeGreaterThanOrEqual(0);
    expect(metrics.compositeScore).toBeLessThanOrEqual(1.5);
  });
});
