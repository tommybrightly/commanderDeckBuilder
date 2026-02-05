# Testing and Commander Rules

## Automated tests

Run the deck builder tests:

```bash
npm run test
```

Watch mode (re-run on file changes):

```bash
npm run test:watch
```

### What the tests cover

- **Deck size**: Output is exactly 99 cards (main + lands) plus commander.
- **Commander excluded**: The commander never appears in the 99-card deck list.
- **Color identity**: Only cards whose color identity is a subset of the commander’s are included (e.g. mono-blue and U/W cards in an Azorius deck).
- **Legality**: With “Enforce Commander legality” on, cards that are banned or not legal in Commander are excluded.
- **No duplicate nonlands**: Each nonland card appears at most once in the main deck (basic lands may appear multiple times in the land section).

These tests use mock card data and `cardInfos` so they don’t need the database or Scryfall.

---

## How to check that rules are correct

### Commander rules we follow

1. **Deck size**: 1 commander + 99 other cards (100 total).
2. **Color identity**: Every card’s color identity must be contained in the commander’s. (We check: for each color in the card’s identity, that color is in the commander’s identity.)
3. **Singleton**: Aside from basic lands, no more than one copy of any card by English name.
4. **Banlist**: When legality is enforced, we exclude cards that are banned or not legal in Commander (using Scryfall’s `legalities.commander` and our internal banlist for cards that are “can be your commander” only, etc.).

### Manual checks you can do

- After building, count: **Commander (1) + nonlands + lands = 100**.
- In the deck view, confirm no card appears twice in the nonland list (except if we ever support multiple copies of a nonbasic; currently we don’t).
- Pick a few cards and confirm their colors fit the commander (e.g. no red cards in an Azorius deck).
- With “Enforce Commander legality” on, search for a known banned card (e.g. Primeval Titan) in your collection and build; it should not appear in the deck.

---

## “Most powerful” deck and limits

The builder is **heuristic**, not an optimizer:

- It fills slots by **role** (ramp, draw, removal, sweepers, synergy, finisher, utility) with **target counts** in the ranges below (e.g. 12 ramp, 11 draw, 4 wipes).
- Within each role it prefers **lower CMC** (curving out).
- It does **not**:
  - Simulate games or win rate.
  - Use power level or tier lists.
  - Consider combos or synergy beyond the role labels.
  - Optimize mana base (e.g. source counts per color).

So “most powerful” here means: **a legal, playable Commander deck that balances roles and curve from your pool**. To improve power:

- Add stronger cards to your collection (and re-build).
- Tweak the engine (e.g. in `deckBuilderEngine.ts`) to change role targets or add new roles.
- Use the built list as a starting point and swap cards by hand for meta or preference.

Running `npm run test` after any change to the deck builder helps ensure size, color identity, legality, and no duplicate nonlands still hold.
