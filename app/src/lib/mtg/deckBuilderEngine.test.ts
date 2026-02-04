import { describe, expect, it } from "vitest";
import { buildDeck } from "./deckBuilderEngine";
import type { CardInfo, CommanderChoice, OwnedCard } from "./types";

function card(
  name: string,
  opts: Partial<CardInfo> & { colorIdentity?: string[]; typeLine?: string; oracleText?: string }
): CardInfo {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    cmc: 0,
    colors: opts.colorIdentity ?? [],
    colorIdentity: opts.colorIdentity ?? [],
    typeLine: opts.typeLine ?? "Creature",
    oracleText: opts.oracleText,
    legalities: opts.legalities ?? { commander: "legal" },
    types: [],
    ...opts,
  };
}

describe("buildDeck", () => {
  it("produces exactly 99 deck cards (main + lands)", async () => {
    const commander: CommanderChoice = {
      id: "atraxa",
      name: "Atraxa, Praetors' Voice",
      colorIdentity: ["W", "U", "B", "G"],
    };
    const cards: CardInfo[] = [
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana of any color." }),
      card("Birds of Paradise", { colorIdentity: ["G"], typeLine: "Creature", oracleText: "Add one mana of any color." }),
      ...Array.from({ length: 80 }, (_, i) =>
        card(`Spell ${i}`, { colorIdentity: ["U", "G"], typeLine: "Creature — Beast" })
      ),
      ...Array.from({ length: 30 }, (_, i) =>
        card(`Land ${i}`, { colorIdentity: ["G"], typeLine: "Land" })
      ),
    ];
    const cardInfos = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
    const owned: OwnedCard[] = cards.map((c) => ({ name: c.name, quantity: 1 }));

    const result = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: true },
      cardInfos,
    });

    const total = result.main.length + result.lands.length;
    expect(total).toBe(99);
    expect(result.commander.name).toBe(commander.name);
  });

  it("does not include the commander in the main deck", async () => {
    const commander: CommanderChoice = {
      id: "teysa",
      name: "Teysa Karlov",
      colorIdentity: ["W", "B"],
    };
    const cards: CardInfo[] = [
      card("Teysa Karlov", { colorIdentity: ["W", "B"], typeLine: "Legendary Creature" }),
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana of any color." }),
      ...Array.from({ length: 100 }, (_, i) =>
        card(`Creature ${i}`, { colorIdentity: ["W", "B"], typeLine: "Creature" })
      ),
    ];
    const cardInfos = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
    const owned: OwnedCard[] = cards.map((c) => ({ name: c.name, quantity: 1 }));

    const result = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: true },
      cardInfos,
    });

    const mainNames = result.main.map((c) => c.name.toLowerCase());
    expect(mainNames).not.toContain("teysa karlov");
  });

  it("only includes cards whose color identity is subset of commander", async () => {
    const commander: CommanderChoice = {
      id: "teferi",
      name: "Teferi, Hero of Dominaria",
      colorIdentity: ["W", "U"],
    };
    const cards: CardInfo[] = [
      card("Lightning Bolt", { colorIdentity: ["R"], typeLine: "Instant", oracleText: "Deal 3 damage." }),
      card("Counterspell", { colorIdentity: ["U"], typeLine: "Instant", oracleText: "Counter target spell." }),
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      ...Array.from({ length: 50 }, (_, i) =>
        card(`UW Spell ${i}`, { colorIdentity: ["W", "U"], typeLine: "Creature" })
      ),
      ...Array.from({ length: 40 }, (_, i) =>
        card(`Land ${i}`, { colorIdentity: ["U"], typeLine: "Land" })
      ),
    ];
    const cardInfos = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
    const owned: OwnedCard[] = cards.map((c) => ({ name: c.name, quantity: 1 }));

    const result = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: true },
      cardInfos,
    });

    const allNames = [...result.main, ...result.lands].map((c) => c.name);
    expect(allNames).not.toContain("Lightning Bolt");
    expect(allNames).toContain("Counterspell");
    expect(allNames).toContain("Sol Ring");
  });

  it("excludes banned cards when enforceLegality is true", async () => {
    const commander: CommanderChoice = {
      id: "atraxa",
      name: "Atraxa",
      colorIdentity: ["W", "U", "B", "G"],
    };
    const cards: CardInfo[] = [
      card("Atraxa", { colorIdentity: ["W", "U", "B", "G"], typeLine: "Legendary Creature" }),
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      card("Primeval Titan", {
        colorIdentity: ["G"],
        typeLine: "Creature",
        legalities: { commander: "banned" },
      }),
      ...Array.from({ length: 100 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["G"], typeLine: "Creature" })
      ),
    ];
    const cardInfos = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
    const owned: OwnedCard[] = cards.map((c) => ({ name: c.name, quantity: 1 }));

    const result = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: true },
      cardInfos,
    });

    const mainNames = result.main.map((c) => c.name);
    expect(mainNames).not.toContain("Primeval Titan");
  });

  it("has no duplicate nonland names in main deck (basics may repeat in lands)", async () => {
    const commander: CommanderChoice = {
      id: "atraxa",
      name: "Atraxa",
      colorIdentity: ["W", "U", "B", "G"],
    };
    const cards: CardInfo[] = [
      card("Atraxa", { colorIdentity: ["W", "U", "B", "G"], typeLine: "Legendary Creature" }),
      ...Array.from({ length: 120 }, (_, i) =>
        card(`Card ${i}`, { colorIdentity: ["G"], typeLine: i < 40 ? "Land" : "Creature" })
      ),
    ];
    const cardInfos = new Map(cards.map((c) => [c.name.toLowerCase(), c]));
    const owned: OwnedCard[] = cards.map((c) => ({ name: c.name, quantity: 1 }));

    const result = await buildDeck({
      owned,
      commander,
      options: { enforceLegality: true },
      cardInfos,
    });

    const mainNames = result.main.map((c) => c.name);
    const uniqueMain = new Set(mainNames);
    expect(uniqueMain.size).toBe(mainNames.length);
    expect(result.main.length + result.lands.length).toBe(99);
  });
});
