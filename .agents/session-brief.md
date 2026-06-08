# Current Session Brief

Scribe owns this file. Keep it short and current.

## Objective

Dashboard v5.1.5 Command Brief Redesign is still in visual review. Owner asked Codex to push the current attempt and preserve context so Claude can take over the next repair pass.

## Owner Decisions

- Dashboard issue is main-line layout and visual hierarchy, not CSS cleanup.
- Scope stays presentation-only.
- Watchlist symbol suggestion is deferred.
- Do not start Phase 3 AI.
- Current top Hero / Portfolio Status Deck direction is liked by owner.
- Current full dashboard is not accepted. Lower sections and responsive behavior still need refinement.
- Owner explicitly asked to push current state and let Claude inspect/fix next.

## Allowed Scope

- Agent operating docs under `.agents/`.
- Short pointer in `AGENTS.md`.
- For current Dashboard work only: `src/app/(app)/dashboard/page.tsx`, `src/app/globals.css`, `src/lib/i18n/dictionary.ts`.

## Forbidden Scope

- API routes, DB, migrations, Supabase helpers, market providers, import engine.
- Position Hub, Holdings page, Journal, Planner, Watchlist.
- Phase 3 AI implementation.
- Broad CSS consolidation outside Dashboard needs.

## Current State

- Branch: `main`.
- Base commit before current Dashboard redesign work: `61a88df`.
- Current files changed: Dashboard presentation files, `.agents/` operating docs, AGENTS pointer.
- Current visual verdict from owner: "Hero card very beautiful, but shrink/responsive and below content still not standard."
- Codex added:
  - Standing agent docs.
  - Dashboard visual spec.
  - Dashboard status deck / decision brief / reference rail attempt.
  - Allocation readout for Donut default.
  - Responsive lock attempt for tablet/mobile.
- Latest verification before push:
  - `git diff --check` passed.
  - `npm.cmd run lint` passed with 4 pre-existing market-provider warnings.
  - `npm.cmd run build` passed, 26/26 pages.
  - Frozen-area diff was empty.
  - Round 1 anchors remained present.

## Open Risks

- Dashboard CSS now has multiple appended v5.1.x override blocks. Claude should consider consolidating the Dashboard-only override section before further visual work.
- Desktop top Hero is promising; do not casually throw it away.
- Lower modules still feel less polished than the hero.
- Responsive needs real screenshot checks at desktop, half-width/tablet, and mobile.
- Browser automation failed in Codex due Windows sandbox/runtime issue, so owner screenshots were the visual QA loop.

## Next Handoff

Claude should start from `.agents/claude-dashboard-handoff-2026-06-09.md`, inspect the current local dashboard, then decide whether to refine the current Status Deck direction or cleanly rebuild the Dashboard presentation layer.
