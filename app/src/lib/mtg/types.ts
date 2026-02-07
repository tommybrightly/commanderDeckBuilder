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

/**
 * Granular card roles for scoring and package completion.
 * Role "families" (e.g. ramp_land, ramp_permanent → ramp) are used for ratio targets;
 * see roleToFamily() in roleAssignment.ts.
 */
export type CardRole =
  // Ramp
  | "ramp"
  | "ramp_land"
  | "ramp_permanent"
  | "ramp_ritual"
  | "ramp_burst"
  // Draw
  | "draw"
  | "draw_burst"
  | "draw_engine"
  | "draw_conditional"
  // Removal
  | "removal"
  | "removal_single"
  | "removal_wipe"
  | "removal_flexible"
  | "sweeper"
  // Interaction (counters, protection, stax)
  | "interaction"
  // Engine pieces
  | "enabler"
  | "payoff"
  // Finishers
  | "finisher"
  | "wincon"
  // Utility
  | "fixing"
  | "protection"
  | "recursion"
  | "tutor"
  | "utility"
  | "synergy"
  | "land"
  | "other";

/** Role family for ratio targets (e.g. all ramp_* count as "ramp"). */
export type RoleFamily =
  | "ramp"
  | "draw"
  | "removal"
  | "sweeper"
  | "interaction"
  | "enabler"
  | "payoff"
  | "finisher"
  | "fixing"
  | "protection"
  | "recursion"
  | "tutor"
  | "utility"
  | "synergy"
  | "land"
  | "other";

export interface CardInDeck {
  name: string;
  quantity: number;
  role?: CardRole;
  cmc?: number;
  typeLine?: string;
  imageUrl?: string;
  /** Short, human-readable reason why this card is in the deck (Phase 6 explainability). */
  reason?: string;
}

export interface DeckList {
  commander: CardInDeck;
  main: CardInDeck[];
  lands: CardInDeck[];
  stats: {
    totalNonlands: number;
    totalLands: number;
    byRole: Partial<Record<CardRole, number>>;
    /** Aggregated by role family (e.g. all ramp_* → ramp) for ratio display. */
    byRoleFamily?: Partial<Record<RoleFamily, number>>;
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

/** Power level (Phase 4.1); affects curve, interaction, tutors. */
export type PowerLevel =
  | "precon"      // higher curve, fewer interaction/tutors
  | "upgraded"    // default
  | "high_power" // lower curve, more interaction
  | "cedh";      // lowest curve, max interaction/tutors

/** Meta (Phase 4.1); affects grave hate, speed, interaction type. */
export type MetaProfile =
  | "combat"     // default
  | "combo"      // more stack interaction
  | "graveyard"; // more grave hate

/** Playstyle (Phase 4.1); affects plan choice and ratios. */
export type Playstyle =
  | "battlecruiser"
  | "spellslinger"
  | "aristocrats"
  | "stax_lite"
  | "balanced";  // default

export interface BuilderOptions {
  enforceLegality: boolean;
  /** Deck style; if not set, defaults to "balanced" (or tribal behavior when commander has tribes). */
  archetype?: DeckArchetype;
  /** Power level; if not set, defaults to "upgraded". */
  power?: PowerLevel;
  /** Meta; if not set, defaults to "combat". */
  meta?: MetaProfile;
  /** Playstyle; if not set, defaults to "balanced". */
  playstyle?: Playstyle;
}
