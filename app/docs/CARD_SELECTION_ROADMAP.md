# Card Selection Roadmap: Toward "Best on the Internet"

This doc captures the target architecture for card selection and a phased plan. North star: **CommanderPlan + Roles + Package Completion + Constraint-aware Optimization + Explanations + Evaluation Harness**.

---

## 1. Where We Are Today

| Piece | Current state |
|-------|----------------|
| **Target profile** | Single “balanced” + archetype (tribal/spellslinger/voltron/control). No power/meta/playstyle. |
| **Commander understanding** | Pattern-based themes (`commanderThemes.ts`) + AI themes + tribe from oracle/type line. No structured “plan.” |
| **Roles** | Single role per card: ramp, draw, removal, sweeper, synergy, finisher, utility, land. No enabler/payoff/tutor/interaction细分. |
| **Scoring** | Greedy: sort by score (curve + synergy), take top until caps. No package completion, no marginal value, no swap cycles. |
| **Candidates** | All owned cards filtered by color/legality, then scored. No shortlist stage. |
| **Lands** | Afterthought: nonbasics from pool by CMC, then basics. No pip/fixing optimization. |
| **Explainability** | None. No “why this card” or “why not that one.” |
| **Evaluation** | Unit tests on themes/curve; no harness vs reference decks. |

---

## 2. Target Model (Summary)

- **Target profile**: Power (precon → cEDH-ish), meta (combat/combo/graveyard), playstyle (battlecruiser/spellslinger/aristocrats/stax-lite). Can be hidden behind “style” at first.
- **CommanderPlan**: Per-commander structured plan: game plan tags, win conditions, key resources, required subpackages, tempo, curve shape, pip intensity, must-have mechanics. Populated by: (A) data from real decklists, (B) parsing commander oracle/keywords, (C) rule-based overrides for known commanders.
- **Roles**: Richer set: ramp (burst/permanent/ritual/land), draw (burst/engine/conditional), removal (single/wipe/flexible), interaction (counters/protection/stax), wincon/finisher, enabler, payoff, fixing, protection, recursion, tutor, utility. Enforce ratios per profile/plan.
- **Two-stage candidates**: Stage 1 = fast shortlist (legality, role relevance, synergy hooks, mana sanity). Stage 2 = deep scoring on shortlist only.
- **Scoring**: Contextual. Marginal value = synergy + role fulfillment + curve + package completion + interaction baseline − opportunity cost. Score relative to current partial deck.
- **Optimizer**: Not pure greedy. Draft → improvement cycles (swap in/out) → validate constraints. Multi-objective with hard constraints (99, identity, land range).
- **Lands**: Part of optimization (pip demand, fixing priority), not appended last.
- **Explainability**: Per-pick reason: role + synergy + why it beat alternatives.
- **Evaluation harness**: Many commanders, compare vs reference decks on curve, role ratios, synergy density, mana stability, wincons/engines, interaction.

---

## 3. Phased Implementation Plan

### Phase 1: Foundation (CommanderPlan + richer roles)

**Goal**: Commander drives a explicit plan; cards have richer roles so we can enforce ratios.

- **1.1** Define `CommanderPlan` type and a first population path:
  - From commander card only (oracle + type line + keywords) → plan tags, wincon hints, key resources, tempo, curve shape.
  - File: `src/lib/mtg/commanderPlan.ts` (new). Consume existing `getCommanderThemes` and extend to a full plan structure.
- **1.2** Extend role taxonomy in `types.ts` and `deckBuilderEngine.ts`:
  - Add role variants (e.g. ramp: burst vs permanent vs land; draw: burst vs engine; enabler vs payoff; interaction).
  - `assignRole()` becomes richer; still rule-based from oracle text/keywords.
- **1.3** Map CommanderPlan → target role ratios and “required packages” (e.g. aristocrats: outlets + fodder + payoffs). Use these as targets in the builder instead of hardcoded numbers.

**Exit condition**: Builder uses a CommanderPlan and target ratios; decks still built greedily but with better targets.

---

### Phase 2: Two-stage candidates + package completion ✅

**Goal**: Fewer cards scored (shortlist), and scoring rewards “completing” packages.

- **2.1** Candidate shortlist (Stage 1):
  - Input: owned cards, commander, plan.
  - Filters: color identity, banned, format; role relevance (card has at least one plausible role for this plan); synergy hooks (tokens, sacrifice, ETB, etc.) where plan needs them; light mana filter (e.g. drop obvious off-curve if plan is fast).
  - Output: subset of owned cards (e.g. few hundred max). All subsequent scoring only on this set.
- **2.2** Package definitions per plan/archetype:
  - E.g. “aristocrats”: need sac outlets (enabler), fodder (enabler), payoffs (Blood Artist–style). Define min counts or ratios.
  - “Spellslinger”: cheap spells + payoffs + mana. “Reanimator”: fatties + discard/mill + reanimate.
- **2.3** Package-completion score:
  - For each card, determine which package(s) it belongs to (enabler/payoff/fodder/etc.).
  - Score boost when adding the card completes or approaches a missing package piece; small penalty when that package is already satisfied.

**Exit condition**: Builder runs on a shortlist; picks are influenced by package completion so decks have real engines, not just goodstuff.

---

### Phase 3: Contextual scoring + interaction baseline ✅

**Goal**: Scoring is relative to current deck state; interaction is guaranteed.

- **3.1** Marginal scoring:
  - Synergy score (existing + plan-alignment).
  - Role fulfillment: if we’re short on ramp/draw/removal, boost those roles; if we’re saturated at 3-mana draw, penalize more of the same.
  - Curve/pacing: target curve per plan (aggro vs control vs midrange); penalize clumping.
  - Package completion (from Phase 2).
  - Opportunity cost: e.g. “strong but we’re overloaded at 4 and light on removal” → prefer the weaker removal spell.
- **3.2** Interaction baseline:
  - Hard or soft minimums for “interaction” (removal + counters + protection). Per profile (e.g. high-power = more).
  - Builder reserves slots or boosts interaction score until threshold met.

**Exit condition**: Each pick is justified by current deck state; decks consistently meet interaction minimums. *(Done: `scoring.ts` — role fulfillment, CMC clump penalty, interaction baseline; engine uses roleTargets + MIN_INTERACTION_TOTAL; fill pass after sweepers ensures ≥10 interaction cards, 14 for control.)*

---

### Phase 4: Target profiles + lands in the loop ✅

**Goal**: User (or internal default) selects power/meta/playstyle; lands are optimized, not appended.

- **4.1** Target profile (internal first):
  - Power: precon / upgraded / high-power / cEDH-ish (affects curve, interaction, tutors, combos).
  - Meta: combat / combo / graveyard (affects grave hate, speed, interaction type).
  - Playstyle: battlecruiser / spellslinger / aristocrats / stax-lite (affects plan choice and ratios).
  - Stored in `BuilderOptions`; no UI required at first.
- **4.2** Profile → plan and ratios:
  - Each profile adjusts CommanderPlan defaults (e.g. tempo, curve shape, interaction level) and role ratios.
- **4.3** Lands as part of optimization:
  - Estimate pip demand from current main deck; prioritize fixing and untapped sources when needed.
  - Optionally: run land count and fixing in the same “draft + improve” loop (Phase 5).

**Exit condition**: Builds can target different profiles; land section reflects deck’s mana needs.

---

### Phase 5: Optimizer (draft + improve cycles) ✅

*Phase 4 done: BuilderOptions power/meta/playstyle; profileTargets.getProfileTargets(); landOptimizer pip demand, landScore, untapped.*

**Goal**: Replace pure greedy with draft-then-improve so balance and constraints are met.

- **5.1** Draft phase:
  - Build an initial 99 using current logic (greedy with contextual scoring). Fast.
- **5.2** Improvement phase:
  - For N cycles: consider swaps (one card in, one card out) that improve a multi-objective score (synergy, curve, roles, packages, interaction) without violating hard constraints (99, color identity, land count range).
  - Validation after each cycle: role ratios, curve, interaction baseline, package minimums.
- **5.3** Multi-objective + constraints:
  - Hard: 99 cards, color identity, land count in [34, 40] (or per profile).
  - Soft: curve shape, role ratios, package completion, synergy. Combine into a single “deck score” or Pareto-style improvements.

**Exit condition**: Builder output is stable under improvement cycles; decks feel balanced and plan-aligned. *(Done: deckOptimizer.ts — deckScore, satisfiesHardConstraints, runImprovementCycles; 5 cycles, swap main-deck cards with pool to improve score; wired after lands in buildDeck.)*

---

### Phase 6: Explainability ✅

**Goal**: Every inclusion has a short, human-readable reason.

- **6.1** Per-card reason:
  - Role(s), synergy tags, “completes X package,” “fills gap in removal/draw/curve.”
  - Optional: “beat alternatives because …” (e.g. “better curve fit than X”, “we had no sweepers”).
- **6.2** Storage and UI:
  - Attach reason to `CardInDeck` (e.g. `reason?: string`). Show on deck view and in API.

**Exit condition**: Users see why each card is in the deck; builds feel trustworthy. *(Done: CardInDeck.reason; explainability.ts — explainPick, explainLand; engine attaches reason to every main and land after optimizer.)*

---

### Phase 7: Evaluation harness ✅

**Goal**: Measure “best” so we can iterate.

- **7.1** Reference data:
  - Curated lists or EDHREC-style aggregates for 50+ popular commanders (structure: commander id, recommended cards, role tags, curve, packages).
- **7.2** Metrics per built deck:
  - Curve sanity (e.g. histogram vs target).
  - Role ratios met (ramp, draw, removal, interaction, etc.).
  - Synergy density (plan tags present).
  - Mana base stability (pip coverage, fixing).
  - Presence of wincons + engines (from plan).
  - Interaction coverage.
- **7.3** Harness:
  - For each test commander, build from a synthetic “owned” pool (e.g. top 200 cards from reference + some filler). Compare built deck vs reference on the metrics above. Regression tests.

**Exit condition**: We can run the harness and say “this change improved or hurt performance on these commanders.”

---

### Phase 8: Personalization and inventory-native features (product layer) ✅

**Goal**: Leverage “owned only” and explanations as differentiators.

- **8.1** “Best possible from what you own” is already the model; tighten copy and UX so it’s obvious.
- **8.2** Upgrade path: “Top N missing cards ranked by impact” (need a way to score missing cards vs current deck/plan).
- **8.3** Alternate builds: same inventory, different profiles or plans (tokens vs combo vs control); show different 99s.
- **8.4** Explainability in UI: tooltips or expandable “why this card” on deck view and in share/export.

---

## 4. File and Module Map (Proposed)

| Area | Current | New / changed |
|------|---------|----------------|
| Commander “brain” | `commanderThemes.ts` | `commanderPlan.ts` (plan type + population from card + optional overrides); themes become one input to plan. |
| Roles | `deckBuilderEngine.ts` (assignRole), `types.ts` | `types.ts` (richer CardRole union); `roleAssignment.ts` or inside engine (assignRole + package tags). |
| Packages | — | `packages.ts` or inside commanderPlan (package definitions per archetype; min counts). |
| Candidate pipeline | Inline in buildDeck | `candidateShortlist.ts` (Stage 1 filters); buildDeck only scores shortlist. |
| Scoring | Inline in buildDeck | `scoring.ts` or clearly named functions in engine: marginalSynergy, roleFulfillment, curveScore, packageCompletion, interactionBaseline. |
| Optimizer | — | `deckOptimizer.ts` (draft + improve cycles, constraint check). |
| Lands | Inline in buildDeck | `landOptimizer.ts` or section in optimizer (pip demand, fixing, basics). |
| Evaluation | `*\.test.ts` | `evaluationHarness.ts` + reference data (JSON or seed); run as script or CI. |
| Explainability | — | Reason strings in `CardInDeck`; optional `explainPick.ts` (generate reason from role + synergy + package + gap). |

---

## 5. Mental Model (Checklist for Every Pick)

The builder should effectively ask:

1. **What’s my commander trying to do?** → CommanderPlan.
2. **What packages do I need for that?** → Enablers + payoffs + fodder etc., from plan and package definitions.
3. **Do I have enough ramp/draw/interaction?** → Role ratios and interaction baseline.
4. **Is my curve playable?** → Curve shape and pacing from plan/profile.
5. **Can I cast my spells?** → Lands and fixing in the loop.
6. **Do I actually win the game?** → Wincon/engine presence from plan.

If every pick is guided by these, we move from “top-score goodstuff” to “best on the internet.”

---

## 6. Suggested Next Steps

1. **Implement Phase 1.1–1.2**: Add `CommanderPlan` type and a first version of plan-from-commander-card; extend roles in types and assignment. No change yet to optimizer.
2. **Add one “package” and package-completion score (Phase 2.2–2.3)** for one archetype (e.g. aristocrats or tokens) to validate the idea.
3. **Introduce shortlist (Phase 2.1)** so we only run deep scoring on a subset.
4. **Add explainability (Phase 6)** early so we can inspect why the builder chose cards; helps debugging and becomes a feature.

After that, tackle contextual scoring (Phase 3), profiles (Phase 4), optimizer (Phase 5), then harness (Phase 7) and product features (Phase 8).

---

*This roadmap is the single source of truth for “how we make card selection best on the internet.” Update it as we implement.*
