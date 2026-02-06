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
    const shortBy = result.stats.shortBy ?? 0;
    expect(total + shortBy).toBe(99); // full deck or short deck (lands capped at 40)
    expect(result.lands.length).toBeLessThanOrEqual(40);
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
  }, 15000);

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
    const total = result.main.length + result.lands.length;
    const shortBy = result.stats.shortBy ?? 0;
    expect(total + shortBy).toBe(99);
    expect(result.lands.length).toBeLessThanOrEqual(40);
  });

  it("prefers creatures that match the commander theme (e.g. Angels/Demons/Dragons for Kaalia)", async () => {
    const commander: CommanderChoice = {
      id: "kaalia",
      name: "Kaalia of the Vast",
      colorIdentity: ["W", "B", "R"],
    };
    const commanderCard = card("Kaalia of the Vast", {
      colorIdentity: ["W", "B", "R"],
      typeLine: "Legendary Creature — Human Cleric",
      oracleText: "Flying. Whenever Kaalia attacks, you may put an Angel, Demon, or Dragon from your hand onto the battlefield.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Random Human", { colorIdentity: ["W"], typeLine: "Creature — Human" }),
      card("Another Human", { colorIdentity: ["W", "B"], typeLine: "Creature — Human Soldier" }),
      card("Big Angel", { colorIdentity: ["W"], typeLine: "Creature — Angel" }),
      card("Big Dragon", { colorIdentity: ["R"], typeLine: "Creature — Dragon" }),
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      ...Array.from({ length: 100 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["W", "B", "R"], typeLine: "Creature — Human" })
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
    expect(mainNames).toContain("Big Angel");
    expect(mainNames).toContain("Big Dragon");
    const angelIdx = mainNames.indexOf("Big Angel");
    const dragonIdx = mainNames.indexOf("Big Dragon");
    const humanIdx = mainNames.indexOf("Random Human");
    expect(angelIdx).toBeGreaterThan(-1);
    expect(dragonIdx).toBeGreaterThan(-1);
    if (humanIdx >= 0) {
      expect(angelIdx).toBeLessThan(humanIdx);
      expect(dragonIdx).toBeLessThan(humanIdx);
    }
  });

  it("prefers instants and sorceries for a spellslinger commander", async () => {
    const commander: CommanderChoice = {
      id: "kess",
      name: "Kess, Dissident Mage",
      colorIdentity: ["U", "B", "R"],
    };
    const commanderCard = card("Kess, Dissident Mage", {
      colorIdentity: ["U", "B", "R"],
      typeLine: "Legendary Creature — Human Wizard",
      oracleText: "Flying. Once each turn, you may cast an instant or sorcery spell from your graveyard. If a spell cast this way would be put into your graveyard, exile it instead.",
    });
    const themeInstant = card("Theme Instant", {
      colorIdentity: ["U"],
      typeLine: "Instant",
      oracleText: "Draw a card. Copy target instant or sorcery you control.",
    });
    const themeSorcery = card("Theme Sorcery", {
      colorIdentity: ["R"],
      typeLine: "Sorcery",
      oracleText: "Deal 2 damage to any target. Whenever you cast an instant or sorcery, draw a card.",
    });
    const genericCreature = card("Generic Creature", {
      colorIdentity: ["U", "B", "R"],
      typeLine: "Creature — Human",
      oracleText: "Vigilance.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana of any color." }),
      themeInstant,
      themeSorcery,
      ...Array.from({ length: 15 }, (_, i) =>
        card(`Instant ${i}`, {
          colorIdentity: ["U", "B", "R"],
          typeLine: "Instant",
          oracleText: "Draw a card.",
        })
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        card(`Sorcery ${i}`, {
          colorIdentity: ["U", "B", "R"],
          typeLine: "Sorcery",
          oracleText: "Whenever you cast an instant or sorcery, copy it.",
        })
      ),
      genericCreature,
      ...Array.from({ length: 80 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["U", "B", "R"], typeLine: "Creature — Human" })
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

    const main = result.main.map((c) => c.name);
    const instantCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("instant")).length;
    const sorceryCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("sorcery")).length;
    expect(main).toContain("Theme Instant");
    expect(main).toContain("Theme Sorcery");
    expect(instantCount).toBeGreaterThanOrEqual(5);
    expect(sorceryCount).toBeGreaterThanOrEqual(5);
    // Theme spells should be included and preferred over generic creatures
    const genericIdx = main.indexOf("Generic Creature");
    const themeInstantIdx = main.indexOf("Theme Instant");
    if (genericIdx >= 0 && themeInstantIdx >= 0) {
      expect(themeInstantIdx).toBeLessThan(genericIdx);
    }
  });

  it("prefers token-makers for a tokens commander", async () => {
    const commander: CommanderChoice = {
      id: "rhys",
      name: "Rhys the Redeemed",
      colorIdentity: ["W", "G"],
    };
    const commanderCard = card("Rhys the Redeemed", {
      colorIdentity: ["W", "G"],
      typeLine: "Legendary Creature — Elf Warrior",
      oracleText: "Create a 1/1 green Elf creature token. Whenever you create a token, create that many tokens plus one instead.",
    });
    const tokenMaker = card("Token Maker", {
      colorIdentity: ["G"],
      typeLine: "Creature — Elf",
      oracleText: "When this creature enters the battlefield, create a 1/1 green Elf creature token.",
    });
    const nonToken = card("Non-Token Creature", {
      colorIdentity: ["W", "G"],
      typeLine: "Creature — Human",
      oracleText: "Flying.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      tokenMaker,
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Token Card ${i}`, {
          colorIdentity: ["W", "G"],
          typeLine: "Creature",
          oracleText: "Create a 1/1 green Elf creature token. Populate.",
        })
      ),
      nonToken,
      ...Array.from({ length: 70 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["W", "G"], typeLine: "Creature — Human" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Token Maker");
    const tokenMakerIdx = main.indexOf("Token Maker");
    const nonTokenIdx = main.indexOf("Non-Token Creature");
    if (nonTokenIdx >= 0 && tokenMakerIdx >= 0) {
      expect(tokenMakerIdx).toBeLessThan(nonTokenIdx);
    }
    const tokenSynergyCount = result.main.filter(
      (c) =>
        (c.typeLine ?? "").includes("Creature") &&
        (cardInfos.get(c.name.toLowerCase())?.oracleText ?? "").toLowerCase().includes("create")
    ).length;
    expect(tokenSynergyCount).toBeGreaterThanOrEqual(5);
  });

  it("prefers +1/+1 counter and proliferate cards for a counters commander", async () => {
    const commander: CommanderChoice = {
      id: "atraxa",
      name: "Atraxa, Praetors' Voice",
      colorIdentity: ["W", "U", "B", "G"],
    };
    const commanderCard = card("Atraxa, Praetors' Voice", {
      colorIdentity: ["W", "U", "B", "G"],
      typeLine: "Legendary Creature — Phyrexian Angel",
      oracleText: "Vigilance, deathtouch, lifelink. At the beginning of your end step, proliferate. Whenever you put a +1/+1 counter on a creature, draw a card.",
    });
    const counterCard = card("Counter Card", {
      colorIdentity: ["G"],
      typeLine: "Creature",
      oracleText: "When this enters the battlefield, put a +1/+1 counter on each creature you control. Proliferate.",
    });
    const vanilla = card("Vanilla Creature", {
      colorIdentity: ["W", "U", "B", "G"],
      typeLine: "Creature — Human",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      counterCard,
      ...Array.from({ length: 25 }, (_, i) =>
        card(`Counter Synergy ${i}`, {
          colorIdentity: ["W", "U", "B", "G"],
          typeLine: "Creature",
          oracleText: "Proliferate. Put a +1/+1 counter on target creature.",
        })
      ),
      vanilla,
      ...Array.from({ length: 70 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["W", "U", "B", "G"], typeLine: "Creature" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Counter Card");
    const counterIdx = main.indexOf("Counter Card");
    const vanillaIdx = main.indexOf("Vanilla Creature");
    if (vanillaIdx >= 0 && counterIdx >= 0) {
      expect(counterIdx).toBeLessThan(vanillaIdx);
    }
  });

  it("prefers sacrifice payoffs for a sacrifice commander", async () => {
    const commander: CommanderChoice = {
      id: "teysa",
      name: "Teysa Karlov",
      colorIdentity: ["W", "B"],
    };
    const commanderCard = card("Teysa Karlov", {
      colorIdentity: ["W", "B"],
      typeLine: "Legendary Creature — Human Advisor",
      oracleText: "If a creature you control would leave the battlefield, exile it instead. Whenever you sacrifice a creature, create a 1/1 white Spirit creature token with flying. Whenever a creature you control dies, each opponent loses 1 life.",
    });
    const sacrificeCard = card("Sacrifice Payoff", {
      colorIdentity: ["B"],
      typeLine: "Creature",
      oracleText: "Whenever you sacrifice a creature, draw a card. Sacrifice a creature: add one mana.",
    });
    const noSac = card("No Sacrifice", {
      colorIdentity: ["W", "B"],
      typeLine: "Creature — Spirit",
      oracleText: "Flying.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      sacrificeCard,
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Sacrifice Synergy ${i}`, {
          colorIdentity: ["W", "B"],
          typeLine: "Creature",
          oracleText: "Whenever a creature is sacrificed, put a +1/+1 counter on this creature. Sacrifice a creature: draw a card.",
        })
      ),
      noSac,
      ...Array.from({ length: 70 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["W", "B"], typeLine: "Creature" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Sacrifice Payoff");
    const sacIdx = main.indexOf("Sacrifice Payoff");
    const noSacIdx = main.indexOf("No Sacrifice");
    if (noSacIdx >= 0 && sacIdx >= 0) {
      expect(sacIdx).toBeLessThan(noSacIdx);
    }
  });

  it("prefers Dragons for The Ur-Dragon (tribal + cost reduce)", async () => {
    const commander: CommanderChoice = {
      id: "ur-dragon",
      name: "The Ur-Dragon",
      colorIdentity: ["W", "U", "B", "R", "G"],
    };
    const commanderCard = card("The Ur-Dragon", {
      colorIdentity: ["W", "U", "B", "R", "G"],
      typeLine: "Legendary Creature — Dragon Avatar",
      oracleText: "Eminence — As long as The Ur-Dragon is in the command zone or on the battlefield, other Dragon spells you cast cost 1 less to cast. Whenever one or more Dragons you control attack, draw that many cards, then you may put a permanent card from your hand onto the battlefield.",
    });
    const dragonCard = card("Good Dragon", {
      colorIdentity: ["R"],
      typeLine: "Creature — Dragon",
      oracleText: "Flying. When this creature attacks, draw a card.",
    });
    const nonDragon = card("Non-Dragon Creature", {
      colorIdentity: ["W", "U", "B", "R", "G"],
      typeLine: "Creature — Human",
      oracleText: "Flying.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      dragonCard,
      ...Array.from({ length: 35 }, (_, i) =>
        card(`Dragon ${i}`, {
          colorIdentity: ["W", "U", "B", "R", "G"].slice(0, (i % 5) + 1),
          typeLine: "Creature — Dragon",
          oracleText: "Flying.",
        })
      ),
      nonDragon,
      ...Array.from({ length: 60 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["W", "U", "B", "R", "G"], typeLine: "Creature — Human" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Good Dragon");
    const dragonCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("dragon")).length;
    const nonDragonInMain = result.main.some((c) => c.name === "Non-Dragon Creature");
    expect(dragonCount).toBeGreaterThanOrEqual(22);
    if (nonDragonInMain) {
      const firstDragonIdx = main.findIndex((n) => cardInfos.get(n.toLowerCase())?.typeLine?.toLowerCase().includes("dragon"));
      const nonDragonIdx = main.indexOf("Non-Dragon Creature");
      expect(firstDragonIdx).toBeLessThan(nonDragonIdx);
    }
  });

  it("prefers artifacts for an artifact commander", async () => {
    const commander: CommanderChoice = {
      id: "urza",
      name: "Urza, Lord High Artificer",
      colorIdentity: ["U"],
    };
    const commanderCard = card("Urza, Lord High Artificer", {
      colorIdentity: ["U"],
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Tap an untapped artifact you control: Add {C}. Artifact creatures you control get +1/+1. You may cast artifact spells as though they had flash.",
    });
    const artifactCard = card("Key Artifact", {
      colorIdentity: ["U"],
      typeLine: "Artifact",
      oracleText: "Whenever an artifact enters the battlefield under your control, put a +1/+1 counter on target creature.",
    });
    const nonArtifact = card("Non-Artifact Creature", {
      colorIdentity: ["U"],
      typeLine: "Creature — Wizard",
      oracleText: "Draw a card.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      artifactCard,
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Artifact ${i}`, {
          colorIdentity: ["U"],
          typeLine: "Artifact",
          oracleText: "Tap: Add one mana of any color. Artifact creatures you control get +1/+1.",
        })
      ),
      nonArtifact,
      ...Array.from({ length: 70 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["U"], typeLine: "Creature" })
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

    const main = result.main.map((c) => c.name);
    const artifactCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("artifact")).length;
    expect(artifactCount).toBeGreaterThanOrEqual(5);
    expect(main).toContain("Key Artifact");
    const keyIdx = main.indexOf("Key Artifact");
    const nonIdx = main.indexOf("Non-Artifact Creature");
    if (nonIdx >= 0 && keyIdx >= 0) expect(keyIdx).toBeLessThan(nonIdx);
  });

  it("prefers landfall/ramp for a landfall commander", async () => {
    const commander: CommanderChoice = {
      id: "tatyova",
      name: "Tatyova, Benthic Druid",
      colorIdentity: ["G", "U"],
    };
    const commanderCard = card("Tatyova, Benthic Druid", {
      colorIdentity: ["G", "U"],
      typeLine: "Legendary Creature — Human Druid",
      oracleText: "Whenever a land enters the battlefield under your control, you gain 1 life and draw a card.",
    });
    const landfallCard = card("Landfall Payoff", {
      colorIdentity: ["G"],
      typeLine: "Creature",
      oracleText: "Landfall — Whenever a land enters the battlefield under your control, put a +1/+1 counter on this creature. Play additional land each turn.",
    });
    const noLandfall = card("No Landfall", {
      colorIdentity: ["G", "U"],
      typeLine: "Creature — Elf",
      oracleText: "Vigilance.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      landfallCard,
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Landfall Synergy ${i}`, {
          colorIdentity: ["G", "U"],
          typeLine: "Creature",
          oracleText: "Whenever a land enters the battlefield under your control, draw a card. Play additional land.",
        })
      ),
      noLandfall,
      ...Array.from({ length: 70 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["G", "U"], typeLine: "Creature" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Landfall Payoff");
    const landfallIdx = main.indexOf("Landfall Payoff");
    const noLandfallIdx = main.indexOf("No Landfall");
    if (noLandfallIdx >= 0 && landfallIdx >= 0) expect(landfallIdx).toBeLessThan(noLandfallIdx);
  });

  it("prefers equipment and auras for a voltron commander", async () => {
    const commander: CommanderChoice = {
      id: "sigarda",
      name: "Sigarda, Host of Herons",
      colorIdentity: ["G", "W"],
    };
    const commanderCard = card("Sigarda, Host of Herons", {
      colorIdentity: ["G", "W"],
      typeLine: "Legendary Creature — Angel",
      oracleText: "Flying, hexproof. Spells and abilities your opponents control can't cause you to sacrifice permanents. Commander damage: 21.",
    });
    const equipmentCard = card("Voltron Equipment", {
      colorIdentity: ["W"],
      typeLine: "Artifact — Equipment",
      oracleText: "Equipped creature gets +3/+3 and has trample. Equip {3}.",
    });
    const auraCard = card("Voltron Aura", {
      colorIdentity: ["G", "W"],
      typeLine: "Enchantment — Aura",
      oracleText: "Enchant creature. Enchanted creature gets +2/+2 and has vigilance.",
    });
    const nonVoltron = card("Generic Creature", {
      colorIdentity: ["G", "W"],
      typeLine: "Creature — Human",
      oracleText: "Flying.",
    });
    const cards: CardInfo[] = [
      commanderCard,
      card("Sol Ring", { colorIdentity: [], typeLine: "Artifact", oracleText: "Add one mana." }),
      equipmentCard,
      auraCard,
      ...Array.from({ length: 15 }, (_, i) =>
        card(`Equipment ${i}`, {
          colorIdentity: ["G", "W"],
          typeLine: "Artifact — Equipment",
          oracleText: "Equipped creature gets +1/+1. Equip {1}.",
        })
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        card(`Aura ${i}`, {
          colorIdentity: ["G", "W"],
          typeLine: "Enchantment — Aura",
          oracleText: "Enchant creature. Enchanted creature gets +1/+1.",
        })
      ),
      nonVoltron,
      ...Array.from({ length: 60 }, (_, i) =>
        card(`Filler ${i}`, { colorIdentity: ["G", "W"], typeLine: "Creature" })
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

    const main = result.main.map((c) => c.name);
    expect(main).toContain("Voltron Equipment");
    expect(main).toContain("Voltron Aura");
    const equipmentCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("equipment")).length;
    const auraCount = result.main.filter((c) => (c.typeLine ?? "").toLowerCase().includes("aura")).length;
    expect(equipmentCount + auraCount).toBeGreaterThanOrEqual(5);
    const equipIdx = main.indexOf("Voltron Equipment");
    const genericIdx = main.indexOf("Generic Creature");
    if (genericIdx >= 0 && equipIdx >= 0) expect(equipIdx).toBeLessThan(genericIdx);
  });
});
