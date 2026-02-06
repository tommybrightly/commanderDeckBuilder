import type { CardInfo } from "./types";

/**
 * Commander synergy: make deck building the best for ANY commander by detecting
 * what the commander's abilities care about and scoring cards that support those themes.
 * Everything revolves around the commander.
 */

export type CommanderThemeId =
  | "spellslinger"
  | "tokens"
  | "counters"
  | "sacrifice"
  | "artifacts"
  | "enchantments"
  | "landfall"
  | "graveyard"
  | "attack"
  | "flying"
  | "lifegain"
  | "draw"
  | "voltron"
  | "etb"
  | "death"
  | "tap_untap"
  | "top_of_library"
  | "copy"
  | "commander_damage";

/** One theme: how to detect it on the commander and how to score cards that support it. */
interface ThemeDef {
  id: CommanderThemeId;
  /** Patterns that indicate this theme in commander oracle text. */
  commanderPatterns: RegExp[];
  /** Card oracle text patterns that get a synergy bonus when this theme is active. */
  cardTextPatterns: RegExp[];
  /** Card type line substrings that get a bonus (e.g. "instant", "artifact"). */
  cardTypeLine: string[];
}

const THEME_DEFS: ThemeDef[] = [
  {
    id: "spellslinger",
    commanderPatterns: [
      /whenever\s+you\s+cast\s+(an?\s+)?(instant|sorcery)/i,
      /instant\s+or\s+sorcery/i,
      /(you\s+may\s+)?cast\s+(an?\s+)?(instant|sorcery)\s+spell/i,
      /whenever\s+(an?\s+)?(instant|sorcery)\s+you\s+cast/i,
      /(instant|sorcery)\s+(spells?\s+)?(you\s+cast|cost)/i,
      /copy\s+(target\s+)?(instant|sorcery)/i,
    ],
    cardTextPatterns: [
      /draw\s+.*\s+card/i,
      /copy\s+target\s+spell/i,
      /cast\s+(an?\s+)?(instant|sorcery)/i,
      /whenever\s+you\s+cast/i,
    ],
    cardTypeLine: ["instant", "sorcery"],
  },
  {
    id: "tokens",
    commanderPatterns: [
      /create\s+(a|\d+)\s+.*\s+token/i,
      /create\s+that\s+many/i,
      /token(s)?\s+(with|enters|you\s+control)/i,
      /double\s+the\s+number\s+of\s+tokens/i,
      /whenever\s+.*\s+token\s+enters/i,
    ],
    cardTextPatterns: [
      /create\s+(a|\d+|\w+)\s+.*\s+token/i,
      /create\s+that\s+many/i,
      /token(s)?\s+(with|enters|you\s+control)/i,
      /populate/i,
      /double\s+token/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "counters",
    commanderPatterns: [
      /\+1\/\+1\s+counter/i,
      /counter(s)?\s+on\s+/i,
      /proliferate/i,
      /put\s+.*\s+counter/i,
      /whenever\s+.*\s+counter\s+is\s+put/i,
      /counters?\s+of\s+any\s+kind/i,
    ],
    cardTextPatterns: [
      /\+1\/\+1\s+counter/i,
      /proliferate/i,
      /put\s+.*\s+counter/i,
      /counter(s)?\s+on\s+/i,
      /doubles?\s+counters/i,
      /whenever\s+.*\s+counter\s+is\s+put/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "sacrifice",
    commanderPatterns: [
      /sacrifice\s+(a\s+)?\w+/i,
      /whenever\s+you\s+sacrifice/i,
      /whenever\s+.*\s+is\s+sacrificed/i,
      /sacrifice\s+.*\s+:/i,
    ],
    cardTextPatterns: [
      /sacrifice\s+(a\s+)?\w+/i,
      /whenever\s+.*\s+sacrifice/i,
      /whenever\s+.*\s+is\s+sacrificed/i,
      /sacrifice\s+.*\s+:/i,
      /as\s+an\s+additional\s+cost.*sacrifice/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "artifacts",
    commanderPatterns: [
      /artifact(s)?\s+(you\s+control|enters|creature)/i,
      /artifact\s+creature/i,
      /whenever\s+.*\s+artifact\s+enters/i,
      /artifact(s)?\s+cost\s+less/i,
      /\bartifact(s)?\b.*\b(tap|untap|mana|cast)\b/i,
      /tap\s+.*\s+artifact/i,
    ],
    cardTextPatterns: [
      /artifact(s)?\s+(you\s+control|enters|creature)/i,
      /artifact\s+creature/i,
      /whenever\s+.*\s+artifact\s+enters/i,
    ],
    cardTypeLine: ["artifact"],
  },
  {
    id: "enchantments",
    commanderPatterns: [
      /enchantment(s)?\s+(you\s+control|enters)/i,
      /whenever\s+.*\s+enchantment\s+enters/i,
      /enchantment(s)?\s+cost\s+less/i,
      /aura\s+spell/i,
  ],
    cardTextPatterns: [
      /enchantment(s)?\s+(you\s+control|enters)/i,
      /whenever\s+.*\s+enchantment\s+enters/i,
    ],
    cardTypeLine: ["enchantment", "aura"],
  },
  {
    id: "landfall",
    commanderPatterns: [
      /landfall/i,
      /whenever\s+(a\s+)?land\s+enters/i,
      /play\s+additional\s+land/i,
      /whenever\s+.*\s+land\s+enters\s+the\s+battlefield/i,
      /land(s)?\s+(you\s+control|enters|fall)/i,
      /draw\s+.*\s+land\s+enters/i,
    ],
    cardTextPatterns: [
      /landfall/i,
      /whenever\s+(a\s+)?land\s+enters/i,
      /search\s+your\s+library\s+for\s+(a\s+)?land/i,
      /put\s+(a\s+)?land\s+(card\s+)?onto/i,
      /play\s+additional\s+land/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "graveyard",
    commanderPatterns: [
      /graveyard/i,
      /from\s+your\s+graveyard/i,
      /whenever\s+.*\s+(die|dies|put\s+into\s+graveyard)/i,
      /discard\s+.*\s+draw/i,
      /mill\s+\d+/i,
      /flashback/i,
      /escape\s+—/i,
      /jump-start/i,
    ],
    cardTextPatterns: [
      /graveyard/i,
      /from\s+your\s+graveyard/i,
      /flashback/i,
      /escape\s+—/i,
      /jump-start/i,
      /unearth/i,
      /return\s+.*\s+from\s+(your\s+)?graveyard/i,
      /mill\s+\d+/i,
      /discard\s+.*\s+draw/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "attack",
    commanderPatterns: [
      /whenever\s+.*\s+attacks?/i,
      /attacking\s+creature/i,
      /combat\s+damage/i,
      /whenever\s+.*\s+deal\s+combat\s+damage/i,
      /each\s+combat/i,
    ],
    cardTextPatterns: [
      /whenever\s+.*\s+attacks?/i,
      /attacking\s+creature/i,
      /haste/i,
      /double\s+strike/i,
      /first\s+strike/i,
      /extra\s+combat/i,
      /each\s+combat/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "flying",
    commanderPatterns: [
      /flying/i,
      /creatures?\s+with\s+flying/i,
      /whenever\s+.*\s+flying\s+creature/i,
    ],
    cardTextPatterns: [/flying/i, /creatures?\s+with\s+flying/i],
    cardTypeLine: [],
  },
  {
    id: "lifegain",
    commanderPatterns: [
      /gain\s+life/i,
      /life\s+total/i,
      /whenever\s+you\s+gain\s+life/i,
      /lifelink/i,
    ],
    cardTextPatterns: [
      /gain\s+life/i,
      /whenever\s+you\s+gain\s+life/i,
      /lifelink/i,
      /life\s+total/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "draw",
    commanderPatterns: [
      /draw\s+.*\s+card/i,
      /whenever\s+you\s+draw/i,
      /draw\s+cards?\s+equal/i,
    ],
    cardTextPatterns: [
      /draw\s+.*\s+card/i,
      /whenever\s+you\s+draw/i,
      /draw\s+cards?\s+equal/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "voltron",
    commanderPatterns: [
      /equipped\s+creature/i,
      /enchant(ed)?\s+creature/i,
      /\+1\/\+1\s+for\s+each\s+(equipment|aura)/i,
      /commander\s+damage/i,
      /\bequip\s+{/i,
      /aura\s+spell|aura\s+—/i,
    ],
    cardTextPatterns: [
      /equipped\s+creature/i,
      /enchant(ed)?\s+creature/i,
      /equip\s+{/i,
      /aura\s+—/i,
    ],
    cardTypeLine: ["equipment", "aura"],
  },
  {
    id: "etb",
    commanderPatterns: [
      /whenever\s+.*\s+enters\s+the\s+battlefield/i,
      /enters\s+the\s+battlefield\s+with/i,
      /when\s+.*\s+enters\s+the\s+battlefield/i,
    ],
    cardTextPatterns: [
      /whenever\s+.*\s+enters\s+the\s+battlefield/i,
      /enters\s+the\s+battlefield\s+with/i,
      /when\s+.*\s+enters\s+the\s+battlefield/i,
      /blink|flicker/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "death",
    commanderPatterns: [
      /whenever\s+.*\s+(die|dies)/i,
      /when\s+.*\s+(die|dies)/i,
      /leaves\s+the\s+battlefield/i,
    ],
    cardTextPatterns: [
      /whenever\s+.*\s+(die|dies)/i,
      /when\s+.*\s+(die|dies)/i,
      /leaves\s+the\s+battlefield/i,
      /whenever\s+.*\s+is\s+put\s+into\s+(a\s+)?graveyard/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "tap_untap",
    commanderPatterns: [
      /tap\s+(target\s+)?\w+/i,
      /untap\s+(target\s+)?\w+/i,
      /whenever\s+.*\s+(tap|untap)/i,
      /vigilance/i,
    ],
    cardTextPatterns: [
      /tap\s+(target\s+)?\w+/i,
      /untap\s+(target\s+)?\w+/i,
      /whenever\s+.*\s+(tap|untap)/i,
      /vigilance/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "top_of_library",
    commanderPatterns: [
      /top\s+of\s+(your\s+)?library/i,
      /scry\s+\d+/i,
      /look\s+at\s+the\s+top\s+/i,
    ],
    cardTextPatterns: [
      /top\s+of\s+(your\s+)?library/i,
      /scry\s+\d+/i,
      /look\s+at\s+the\s+top\s+/i,
      /reveal\s+the\s+top\s+/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "copy",
    commanderPatterns: [
      /copy\s+(target\s+)?(instant|sorcery|spell|creature)/i,
      /whenever\s+you\s+copy/i,
    ],
    cardTextPatterns: [
      /copy\s+(target\s+)?(instant|sorcery|spell|creature)/i,
      /whenever\s+you\s+copy/i,
    ],
    cardTypeLine: [],
  },
  {
    id: "commander_damage",
    commanderPatterns: [/commander\s+damage/i, /deal\s+combat\s+damage.*player/i],
    cardTextPatterns: [
      /trample/i,
      /double\s+strike/i,
      /haste/i,
      /commander\s+damage/i,
    ],
    cardTypeLine: ["equipment", "aura"],
  },
];

/**
 * Detect which themes the commander's abilities care about (oracle text only).
 * Used to score cards: the more a card supports these themes, the higher its synergy.
 */
export function getCommanderThemes(commander: CardInfo): CommanderThemeId[] {
  const text = (commander.oracleText ?? "").toLowerCase();
  if (!text.trim()) return [];
  const themes: CommanderThemeId[] = [];
  for (const def of THEME_DEFS) {
    const matches = def.commanderPatterns.some((p) => p.test(text));
    if (matches) themes.push(def.id);
  }
  return themes;
}

/**
 * Score how well a card synergizes with the commander's detected themes (0 = no synergy, higher = better).
 * Sums bonuses for each theme the commander has that the card supports.
 * When a card matches multiple themes we apply a small multiplier so multi-synergy cards rank higher.
 */
export function commanderSynergyScore(card: CardInfo, themeIds: CommanderThemeId[]): number {
  if (themeIds.length === 0) return 0;
  const cardText = (card.oracleText ?? "").toLowerCase();
  const cardType = (card.typeLine ?? "").toLowerCase();
  let score = 0;
  let matchCount = 0;
  for (const id of themeIds) {
    const def = THEME_DEFS.find((d) => d.id === id);
    if (!def) continue;
    let themeMatch = false;
    for (const p of def.cardTextPatterns) {
      if (p.test(cardText)) {
        themeMatch = true;
        score += 2.0; // text match: card explicitly supports commander theme
        matchCount += 1;
        break;
      }
    }
    if (!themeMatch && def.cardTypeLine.length > 0) {
      for (const type of def.cardTypeLine) {
        if (cardType.includes(type)) {
          themeMatch = true;
          score += 1.5; // type match: e.g. instant/sorcery for spellslinger
          matchCount += 1;
          break;
        }
      }
    }
  }
  if (matchCount >= 2) score *= 1 + 0.12 * (matchCount - 1);
  return score;
}
