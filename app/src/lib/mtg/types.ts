export interface OwnedCard {
  name: string;
  quantity: number;
  setCode?: string;
  collectorNumber?: string;
}

export interface CardInfo {
  id: string;
  name: string;
  manaCost?: string;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
  typeLine: string;
  oracleText?: string;
  imageUrl?: string;
  legalities?: Record<string, string>;
  isLegendary?: boolean;
  supertypes?: string[];
  types: string[];
}

export interface CommanderChoice {
  id: string;
  name: string;
  colorIdentity: string[];
  imageUrl?: string;
  typeLine?: string;
}

export type CardRole =
  | "ramp"
  | "removal"
  | "draw"
  | "sweeper"
  | "synergy"
  | "utility"
  | "finisher"
  | "land"
  | "other";

export interface CardInDeck {
  name: string;
  quantity: number;
  role?: CardRole;
  cmc?: number;
  typeLine?: string;
  imageUrl?: string;
}

export interface DeckList {
  commander: CardInDeck;
  main: CardInDeck[];
  lands: CardInDeck[];
  stats: {
    totalNonlands: number;
    totalLands: number;
    byRole: Partial<Record<CardRole, number>>;
    colorIdentity: string[];
    /** Set when deck has fewer than 99 cards (e.g. land cap left deck short). */
    shortBy?: number;
    /** Short explanation of how the deck is meant to be played (AI-generated when available). */
    strategyExplanation?: string;
  };
  legalityEnforced: boolean;
}

/** Deck style / archetype; influences creature counts, type caps, and what we prioritize. */
export type DeckArchetype =
  | "balanced"   // 25–30 creatures, normal caps
  | "tribal"     // 30–35 creatures, strong theme
  | "spellslinger" // few creatures, many instants/sorceries
  | "voltron"    // 18–22 creatures, favor equipment/auras
  | "control";  // 16–22 creatures, more removal/draw

export interface BuilderOptions {
  enforceLegality: boolean;
  /** Deck style; if not set, defaults to "balanced" (or tribal behavior when commander has tribes). */
  archetype?: DeckArchetype;
}
