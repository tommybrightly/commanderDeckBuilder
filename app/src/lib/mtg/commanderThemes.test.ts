import { describe, expect, it } from "vitest";
import type { CardInfo } from "./types";
import { getCommanderThemes, commanderSynergyScore } from "./commanderThemes";

function card(name: string, overrides: Partial<CardInfo> = {}): CardInfo {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    cmc: 2,
    colors: [],
    colorIdentity: [],
    typeLine: "Creature",
    ...overrides,
  };
}

describe("commanderThemes", () => {
  it("detects spellslinger from commander oracle text", () => {
    const c = card("Niv", { oracleText: "Whenever you cast an instant or sorcery, draw a card." });
    expect(getCommanderThemes(c)).toContain("spellslinger");
  });

  it("detects tokens theme", () => {
    const c = card("Tiny", { oracleText: "Whenever a creature enters, create a 1/1 token." });
    expect(getCommanderThemes(c)).toContain("tokens");
  });

  it("detects +1/+1 counters theme", () => {
    const c = card("Counter", { oracleText: "Whenever you put a +1/+1 counter on a creature, draw a card." });
    expect(getCommanderThemes(c)).toContain("counters");
  });

  it("detects sacrifice theme", () => {
    const c = card("Sac", { oracleText: "Whenever you sacrifice a creature, each opponent loses 1 life." });
    expect(getCommanderThemes(c)).toContain("sacrifice");
  });

  it("detects attack theme", () => {
    const c = card("Combat", { oracleText: "Whenever a creature you control attacks, put a +1/+1 counter on it." });
    expect(getCommanderThemes(c)).toContain("attack");
  });

  it("returns empty when oracle text is empty", () => {
    expect(getCommanderThemes(card("Vanilla", { oracleText: "" }))).toEqual([]);
  });

  it("scores card higher when it supports commander themes", () => {
    const commander = card("Spells", { oracleText: "Whenever you cast an instant or sorcery, draw a card." });
    const themes = getCommanderThemes(commander);
    expect(themes).toContain("spellslinger");

    const instant = card("Bolt", { typeLine: "Instant", oracleText: "Deal 3 damage to any target." });
    const creature = card("Bear", { typeLine: "Creature — Bear", oracleText: " " });
    const instantScore = commanderSynergyScore(instant, themes);
    const creatureScore = commanderSynergyScore(creature, themes);
    expect(instantScore).toBeGreaterThan(creatureScore);
  });
});
