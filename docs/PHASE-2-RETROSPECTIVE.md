# Phase 2 Retrospective — TradeOS v5

_Closed 2026-06-04 · release `v5.0.0` · repo `ianthony89/TradeOS-v5` · deploy `tradeos-v5.vercel.app`_

Phase 2 turned TradeOS from a portfolio **tracker** into a portfolio **decision loop**:
**Dashboard detects → Journal reviews → Position Hub decides → Planner simulates.**
It was validated against a real 14-position portfolio (live UAT) before freezing.

---

## 1 · What was built

| Sub-phase | Surface | Summary |
|---|---|---|
| **2A** | **Position Hub** `/holdings/[symbol]` | Per-position decision cockpit: Investment Thesis (10 starter templates + sentence "Strengthen Thesis" blocks), Target Planner (price ladder), lightweight Conviction + Review Schedule, Decision Log, and a 5-dimension **Position Quality** grade (Thesis · Target Plan · Decision Log · Conviction · Review → A+/A/B/C/D). |
| **2B** | **Dashboard Attention Layer** | A prioritized **Attention Feed** ("what needs my attention today") fusing price + review-due + missing-thesis/targets (top-5) + watchlist-triggered, plus a **Review Queue**. Every item deep-links into the Hub. Engine `attention.ts` replaced the price-only `action-center.ts`. |
| **2C** | **Journal** `/journal` | Cross-position **Review Workspace**: Review Pulse, Review Queue (expand → thesis/targets, mark reviewed with a required cadence), Review History. |
| **2D** | **Planner** `/planner` | Read-only **Portfolio Action Simulator** (`planner.ts`): Add Capital (proportional or strategy-gap), Reduce Concentration, Target Allocation by strategy. Pure deterministic math, no writes. |
| **2E** | **QA + real-portfolio UAT** | Error surfacing on all writes, live-price overlay + self-fetch, FX divide-by-zero guard; live UAT (0 P0/P1, 3 P2 fixed). |

**Data model:** one new table `position_intelligence` (1 row per `user_id` × `symbol_normalized`) + reuse of `journal_entries` for the decision/review log (migration `007`). Keyed by normalized symbol so intelligence survives a CSV re-import or a full exit.

---

## 2 · Major architecture decisions

1. **One table, keyed by `(user_id, symbol_normalized)`.** Thesis + targets + conviction + review live in a single 1:1 row; the decision log reuses `journal_entries`. No per-feature tables. The normalized key means a future cross-position page (the Journal) reads the same rows with no symbol filter — which is exactly what 2C did.
2. **Client-Supabase + RLS, no API routes for intelligence.** Follows the established watchlist/holdings pattern. Owner-only RLS. Fewer moving parts than a server layer.
3. **Rules-based, deterministic — no AI.** `attention.ts` and `planner.ts` are pure functions over existing holdings/intel. Every "suggestion" is reproducible math, not a model. This was a hard product constraint and it kept the surfaces trustworthy and testable.
4. **Role separation + deep-links.** Each surface has exactly one job (Detect / Review / Decide / Simulate) and routes you to the next via deep-links, rather than duplicating editing UI. The Planner never writes; the Dashboard/Journal only route into the Hub to act.
5. **Freeze-after-validation discipline.** Each surface was frozen ("bug fixes only") once accepted, so later phases couldn't silently regress it. Shared pure libs (`position-quality.ts`, `review-status.ts`, `live-price.ts`) were extracted specifically so new work could reuse frozen logic **without editing the frozen file**.
6. **Live-price consistency via the shared quote store + per-page self-fetch.** Phase 2E made the Hub/Planner/Journal overlay the same live quotes the Dashboard uses (and self-fetch on cold load), so the four surfaces agree.
7. **EN+ZH everywhere, design-token CSS, investor-notebook voice.** No hard-coded strings; copy reads like a trader's own notes (no MBA-speak, no em dashes in UI).

---

## 3 · Lessons learned

1. **Verify the remote and the live deploy — not the local push output.** The biggest miss of Phase 2: for most of it, `git push` reported success but the bytes were **sandbox-intercepted and never reached GitHub**, and the screenshots shown were **local mockups**, not the deployed app. The whole v5 history was sitting only on the dev machine while Vercel served the legacy app. *Fix going forward:* every push is confirmed with `git ls-remote origin main` (remote SHA == local), and "done" means **seen on the live URL**, never a mockup.
2. **Supabase doesn't throw — check `{ error }`.** Phase 2A–2D writes discarded the returned `{ error }`, so a failed save (RLS, offline, or missing table) looked successful. 2E made every write throw + surface a banner. Silent success is worse than a visible failure.
3. **Surface environmental dependencies loudly.** The app silently depended on migration `007`; without it, saves no-op'd invisibly. Now their absence is visible.
4. **Test on real data early.** The live UAT (real 14 positions) instantly caught two things a code trace missed: the watchlist showing **NEAR_TARGET** for symbols with no price, and a misleading empty-queue copy.
5. **Aggressive scope-cutting + freezing works.** Repeatedly trimming (drop sunburst/treemap, Planner sector mode out, single Add-Capital engine) kept each surface shippable and made the freezes meaningful.

---

## 4 · Deferred items (by owner decision)

- **AI analysis** (`/ai` stays a stub) — explicitly off.
- **Alerts / notifications** (price + review-due) — DB foundations may exist; no UI.
- **News / earnings feeds.**
- **Planner v2** — sector-based Target Allocation, persisted plans, cash-balance tracking.
- **Watchlist editing** — currently delete + re-add to change a target.

---

## 5 · Known limitations

- **Cross-page weight drift (by design).** Each page self-fetches its own quote snapshot, so values observed minutes apart drift with the live market. Loaded simultaneously they agree; a shared frozen timestamp would only add staleness. Documented, intentionally unchanged.
- **Quote fetch on every page nav.** Hub/Journal/Planner self-fetch quotes on mount; rapid navigation fires several `/api/quotes` calls and can hit provider latency/rate limits (graceful — falls back to the DB snapshot).
- **Planner cash is transient** (not persisted) — re-entered each visit.
- **Holdings page shows no portfolio total** (only per-row native-currency values).
- **Migration 007 is a manual deploy step** — must be run in Supabase before Conviction/Review/Journal persist.
- **Dashboard auto-refreshes quotes every 30 min** — manual refresh otherwise.
- **Quote-provider coverage gaps** — some watched tickers return no price (`—`); now shown as WATCHING.

---

_This document is the archival record of Phase 2. The canonical operating contract is `AGENTS.md`; phase status is `ROADMAP.md`._
