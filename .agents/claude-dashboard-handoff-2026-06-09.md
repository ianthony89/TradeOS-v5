# Claude Dashboard Handoff - 2026-06-09

## TL;DR

Anthony asked Codex to stop iterating and push the current Dashboard redesign attempt so Claude can take over.

The current top Hero / Portfolio Status Deck is the only part Anthony explicitly likes. The rest is not accepted.

## Owner Verdict

Latest owner feedback:

- "Hero card is very beautiful."
- "But when you shrink it?"
- "The things below still have problems."
- "Still not to standard."
- Push current state, save the latest record, and let Claude take over.

## Current Visual Direction

Intent was to move away from scattered dashboard cards toward:

- One Portfolio Status Deck at the top.
- One Decision Brief card below.
- A right Reference Rail with Sector Allocation and Return Board.
- Portfolio Health as a lower diagnostic strip.
- My Holdings as full list, no internal vertical scroll.

## What Codex Changed

Dashboard presentation files:

- `src/app/(app)/dashboard/page.tsx`
  - Added dashboard-local money display helper.
  - Preserved Round 1 data semantics.
  - Added allocation readout under Donut default using existing sector math.
- `src/app/globals.css`
  - Added v5.1.5/v5.1.6/v5.1.7 Dashboard override blocks.
  - Built current Status Deck appearance.
  - Added responsive lock attempt for tablet/mobile.
- `src/lib/i18n/dictionary.ts`
  - Added/adjusted Dashboard copy keys for the redesign.

Agent docs:

- `.agents/README.md`
- `.agents/01-scribe-context.md`
- `.agents/02-ramanujan-dashboard.md`
- `.agents/03-ada-ai-research.md`
- `.agents/04-tesla-design-uiux.md`
- `.agents/05-fermat-qc.md`
- `.agents/session-brief.md`
- `.agents/handoff-template.md`
- `.agents/dashboard-v515-visual-spec.md`

## What Must Be Preserved

Round 1 stabilization anchors:

- `const supabase = useMemo(() => createClient(), [])`
- `refreshQuotes(rows?)` supports fresh rows.
- CSV import calls `await refreshQuotes(rows)`.
- Ticker uses daily move semantics via `todayMovePct`.
- Best/Winners/My Holdings total return use unified total-return helper.
- Donut default remains `useState<AllocView>('donut')`.

Do not touch:

- API routes.
- DB / migrations.
- Supabase helpers.
- market providers.
- import engine.
- Position Hub, Holdings page, Journal, Planner, Watchlist.
- Phase 3 AI.

No fake AI:

- No AI confidence.
- No thesis broken.
- No risk trend.
- No prediction/forecast/model score.

## Current Known Problems

1. Lower modules do not match the Hero quality.
   - Decision Brief still feels more like a composed table/card than a premium command brief.
   - Sector Allocation and Return Board are improved but still read as separate widgets.
   - Portfolio Health still feels diagnostic-heavy.

2. Responsive behavior needs real visual QA.
   - Codex added a responsive lock after owner screenshots showed mobile overlay.
   - This must be checked in the actual browser at desktop, half-width/tablet, and mobile.

3. CSS quality risk.
   - `globals.css` now contains several historical v5.1.x Dashboard blocks plus new override blocks.
   - Claude should consider a Dashboard-only CSS cleanup/replacement instead of stacking more overrides.
   - Do not do broad global CSS cleanup.

4. Design-system rhythm is not complete.
   - Hero is strong.
   - Below hero needs a more coherent surface system, spacing rhythm, and hierarchy.

## Commands Already Passing

Run again after any fix:

```powershell
git diff --check
npm.cmd run lint
npm.cmd run build
```

Expected lint state before Claude changes:

- 0 errors.
- 4 existing warnings in market providers:
  - `src/lib/market/providers/finnhub-provider.ts`
  - `src/lib/market/providers/yahoo-provider.ts`

Regression checks:

```powershell
rg -n "const supabase = useMemo\(\(\) => createClient\(\), \[\]\)|refreshQuotes\(|await refreshQuotes\(rows\)|todayMovePct|positionTotalReturnPct|useState<AllocView>\('donut'\)" "src/app/(app)/dashboard/page.tsx"
git diff -- next.config.ts src/app/api src/lib/supabase src/lib/market src/stores/holdings.ts supabase/migrations
rg -n "AI confidence|thesis broken|risk trend|predict|prediction|forecast|LLM|model score|Best Position|hero_best|RiskArc" "src/app/(app)/dashboard/page.tsx" src/app/globals.css
```

## Suggested Claude Starting Point

1. Open Dashboard locally and capture screenshots:
   - Desktop wide.
   - Desktop half-width.
   - Mobile width around 390px.
   - Light and dark if possible.

2. Keep the successful top Hero direction if it still looks good.

3. Rebuild or consolidate Dashboard-only CSS for:
   - Decision Brief.
   - Reference Rail.
   - Portfolio Health.
   - Responsive breakpoints.

4. Avoid adding new modules. Anthony wants better composition, not more features.

5. Do not commit until owner visually accepts unless explicitly asked.
