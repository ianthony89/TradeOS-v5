# Dashboard v5.1.5 Visual Spec

Status: Draft for owner approval. Do not implement until Anthony approves.

## Objective

Turn the Dashboard into a coherent command brief. The current layout direction is acceptable, but the composition still feels uncoordinated because several modules do not visually hold their own content.

This is a presentation pass only. No API, DB, import, market provider, Holdings page, Watchlist, Journal, Planner, or Position Hub work.

## Current Problems From Owner Screenshot

### 1. Holdings Value Hero

Problem:

- The hero has a strong main number, but the left side still feels hollow.
- The three small chips under the value look like ordinary boxes, not part of a premium holdings-value module.
- The value, helper facts, and quick pulse do not yet behave like one integrated "IC" module.

Product intent:

- Hero should answer: "What is my portfolio worth right now, and what is the immediate context?"
- It should not include performance ranking such as Best Position / Top Return.
- The supporting facts should explain the holdings value, not compete with KPI cards.

Spec:

- Keep primary value as the anchor.
- Keep quick pulse: Today Winner, Today Loser, Open, Closed.
- Replace the three plain chips with a more intentional indicator strip.
- Suggested indicators, all existing-data only:
  - Capital Deployed / Cost Basis
  - Total Return
  - Largest Weight / Concentration
- The indicator strip should feel connected to the main value through spacing, subtle accents, and shared surface treatment.
- Avoid large vertical voids above or below the value.

Acceptance:

- The hero feels like one complete financial module.
- No awkward empty space in the left half.
- The secondary indicators read as useful context, not random mini cards.

### 2. Decision Brief

Problem:

- Current Decision Brief still has too much empty space.
- Action Center and Risk Summary are visually present, but the whole card does not yet read as a polished "brief."
- The card height is not content-driven enough; empty area makes it feel unfinished.

Product intent:

- Decision Brief answers: "What should I inspect first, and why?"
- Action Center is primary.
- Risk Summary explains the action context, not a separate dashboard.

Spec:

- Rebuild Decision Brief as a compact content-driven module.
- Preferred structure:
  - Header: Decision Brief + "Actions + risk drivers"
  - Main body: Priority Actions list
  - Risk can be:
    - a compact side summary if width allows, or
    - a compact bottom strip if side summary creates bad whitespace.
- Avoid a giant container that extends far below the last row.
- Action rows must not collide with CTA, symbol, weight, or lead return.
- Risk should use compact score + meter + concise drivers.

Acceptance:

- No major empty block below Action/Risk content.
- User can scan first action in under 2 seconds.
- Risk does not visually compete with actions.
- No row text overlaps or cramped CTA.

### 3. Sector Allocation

Problem:

- Donut colors look dull/muddy in dark theme.
- The panel surface feels related to the rest of the rail but not polished enough.

Product intent:

- Sector is reference material: calm, legible, secondary.
- Colors should be premium, readable, and distinct.

Spec:

- Use Dashboard-local sector color overrides only.
- Do not change global sector tokens.
- Improve color clarity:
  - Technology: cleaner blue
  - ETF: cleaner gold
  - Utilities: softer violet
  - Healthcare: clear emerald
  - Discretionary: restrained orange
- Donut should remain calm, not neon.

Acceptance:

- In dark mode, segments are distinct without looking game-like.
- In light mode, colors remain readable and not muddy.
- No changes outside Dashboard.

### 4. Return Board

Problem:

- 2 winners + 2 losers feels short and visually unbalanced against Sector Allocation.
- Owner prefers 3 + 3 rhythm.

Product intent:

- Return Board is reference material for total-return extremes.
- It should not invent missing data.

Spec:

- Render up to 3 winners and 3 losers.
- If fewer than 3 rows exist, use honest quiet empty state or allow the section to be shorter without fake data.
- Keep label semantics clear: this is total return, not daily movers.
- Background tint should be subtle and coordinated with reference rail.

Acceptance:

- Return Board feels balanced in the right rail.
- No fake third winner/loser.
- Winner/loser color is readable but not loud.

### 5. My Holdings Table

Problem:

- Total Return % and adjacent numeric columns have too much horizontal breathing room.
- The table feels like a spreadsheet, not a trading product table.

Product intent:

- My Holdings is full-width detail.
- It should be dense, calm, and easy to scan.

Spec:

- Use fixed table layout only within Dashboard.
- Symbol column stays dominant but not excessive.
- Numeric columns should have consistent rhythm:
  - Weight
  - Value
  - Total Return %
  - Unrealized $
  - Today
  - Action
- Keep row height comfortable but not oversized.
- Preserve full list; no internal vertical scroll.

Acceptance:

- Total Return % no longer appears isolated by large side gaps.
- Rows scan left to right like a trading table.
- Mobile retains horizontal scroll if needed; no text overlap.

## Agent Workflow

1. Scribe keeps this spec and `session-brief.md` current.
2. Tesla reviews this spec visually before implementation.
3. Ramanujan implements only after owner approval.
4. Fermat runs QC before commit.
5. Ada is not used in this round.

## Allowed Files For Implementation

- `src/app/(app)/dashboard/page.tsx`
- `src/app/globals.css`
- `src/lib/i18n/dictionary.ts` only if copy changes

## Useful Files To Read

- `src/components/ui/allocation-views.tsx`
- `src/components/ui/donut-chart.tsx`
- `src/components/ui/panel.tsx`
- `src/components/ui/stat-card.tsx`

## Do Not Do

- No API / DB / migration changes.
- No Supabase helper changes.
- No import engine changes.
- No Holdings page / Watchlist / Journal / Planner / Position Hub changes.
- No fake AI, confidence scores, thesis-broken claims, or risk trends.
- No broad CSS consolidation.
- No commit until owner visually approves.

