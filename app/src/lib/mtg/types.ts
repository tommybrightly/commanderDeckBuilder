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
  };
  legalityEnforced: boolean;
}

export interface BuilderOptions {
  enforceLegality: boolean;
}
