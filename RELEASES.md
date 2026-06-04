# Releases

_Newest first. Each version is tagged in git._

---

## v5.0.6 — 2026-06-04

**Dashboard cleanup** — a maintenance release: simpler, no duplication with Holdings, and a P0 data-correctness fix. Not a redesign.

- **P0 — closed-position leak fixed.** The Dashboard loaded *all* holdings with no quantity filter, so closed positions (qty 0) polluted every ranking — CETX surfaced in Top Losers / Risk / Attention because the live-recompute derives its % from `(livePrice − avgCost)` ignoring qty=0. The Dashboard now uses **open positions only** (`quantity > 0`) at the single load choke point, so every downstream metric (movers, risk, sector, attention, ticker, totals) is open-only. (Live proof: "positions down >50%" dropped from 4 → 3 once CETX was excluded.)
- **Removed** (duplicated Holdings): Review Queue · Top Movers · Positions widget.
- **What Needs My Attention** is now full-width and reordered: **EXIT / −50% → REDUCE → Review → other**.
- **Risk Assessment** keeps the widget but trades engineering jargon for plain sentences — *"AIXI is 31% of your portfolio", "39% of your portfolio is speculative", "3 positions are down more than 50%".*
- Consolidated the P&L stat into a single **Total P&L** (unrealized + realized).
- **Holdings:** removed the redundant **Status** column (open table = open, closed table = closed); **Closed Positions** is **collapsed by default** and gains a **Sold Price** column (`exit_price`, migration 008).

Untouched: Journal / Planner / Watchlist / Position Hub / quote provider + API / import engine / migration 008 / source-of-truth logic. **Tag:** `v5.0.6`.

---

## v5.0.5 — 2026-06-04

**Holdings UX reset — one unified Moomoo-style table.** Removes the v5.0.2–v5.0.4 multi-view (Overview / Performance / Insights + the view switch). One position is now one row, every column visible at once.

- **Summary bar** above the table — Portfolio Value · Today's P&L · Total P&L · Open · Closed. Holdings is now the primary portfolio screen (you don't need the Dashboard to read your book).
- **One unified table**, default sort Market Value desc, **sticky Symbol column** + horizontal scroll (Moomoo desktop + mobile), with `$ / %` stacked inside the Total P&L and Unrealized P&L cells. **Action** (HOLD / REDUCE / EXIT) and **Status** (OPEN / CLOSED) are always visible.
- **Session badges gained emoji** — 🟢 LIVE · 🔵 PRE · 🟠 POST · 🌙 LAST CLOSE (topbar pill + overnight banner; alignment architecture unchanged).
- **Upgraded Closed Positions** — Exit Date · Realized P&L · Current Price · **Since Exit %** · Status, each row **expandable** to Entry/Exit dates, Holding Days, Strategy, **Thesis**, and Lessons Learned (reuses Position Intelligence + journal — no new tables).

> **⚠ Migration 008 (`exit_price` + `exit_date` on `holdings`) must be applied in Supabase.** `current_price` is rewritten by the quote engine on every Dashboard/Journal/Planner/Hub visit, so it can't anchor "Since Exit %"; 008 stores a frozen exit snapshot at the close-in-place transition. The import writes it best-effort, so the app runs without 008 — Exit Date / Since Exit just show "—" until it's applied. Positions closed *before* 008 (e.g. CETX) have no snapshot to backfill; closures *after* it do.

Import close-in-place (v5.0.4) kept; CSV remains source of truth. Dashboard / Journal / Planner / Watchlist / Position Hub / market providers / quote API untouched. **Tag:** `v5.0.5`.

---

## v5.0.4 — 2026-06-04

**Holdings = source of truth** — fixes positions lingering after they leave the CSV, adds closed-position tracking, and refocuses the views.

- **CSV is now the source of truth.** On import, any open position absent from the new CSV is **closed in place** (quantity / market value / live P&L → 0; symbol / name / avg cost / realized P&L kept). Nothing is deleted, so all thesis / review / journal history survives (those tables are symbol-keyed). Fixes the bug where a sold position (CETX) stayed an active holding forever.
- **Closed Positions section** — exited positions move to a dedicated section below the table (symbol · status · realized P&L · Hub link), instead of polluting the active list or vanishing.
- **Status column** — OPEN / CLOSED, derived (no DB column, no migration).
- **Views refocused** — Allocation + Trading removed; new **Insights** view added (Symbol · Status · Strategy · Action · Unrealized % · Weight), bringing back the Action signal.

Display + import-layer only. No migration, no store schema change. Dashboard / Journal / Planner / Watchlist / Position Hub untouched; all historical data preserved. The v5.0.3 per-row pre/post move badge was dropped with the Trading view (the topbar session pill + Last Close banner remain). **Tag:** `v5.0.4`.

---

## v5.0.3 — 2026-06-04

**Market session alignment** — quote-honesty, display-layer only (no new providers, no paid APIs, no calc / DB / schema changes; the frozen market layer is untouched).

Yahoo carries no live US overnight price, so during the overnight session TradeOS was showing the 4:00pm regular close while implying it was live. v5.0.3 makes the displayed session explicit:

- **Topbar freshness pill** now carries a session tag — `LIVE` / `PRE` / `POST` / `LAST CLOSE` (driven by the US market clock).
- **Holdings** shows an honesty banner when the US market is not in regular hours — e.g. *"Last Close — US market is overnight; showing the last regular-session close."* — so a non-live price is never implied to be live.
- **Holdings (Trading view)** shows a **separate** per-row extended-hours move badge (`PRE +2.14` / `POST -1.80`), derived from the pre/post price already present in the quote.
- **Today's P&L is unchanged** — still the regular-session day change; the session move is a new, separate element and never repurposes it.

New pure helper `lib/market/quote-session.ts` + `SessionTag` / `SessionMoveTag` components. Touches only the topbar + Holdings; Dashboard / Position Hub / Journal / Planner untouched. Overnight path validated live against the real 14-position portfolio. **Tag:** `v5.0.3`.

---

## v5.0.2 — 2026-06-04

**Holdings multi-view mode** — presentation-only UX enhancement (no new data, DB, migrations, calculations, or APIs).

A segmented view switch above the Holdings table replaces the single all-in-one table with four focused lenses, so one dimension is in view at a time (lower cognitive load, Moomoo-style):
- **Overview** — Symbol / Market Value / Weight / Today's P&L / Total P&L
- **Performance** — Symbol / Unrealized P&L / Unrealized % / Realized P&L / Total P&L / Total Return %
- **Allocation** — Symbol / Weight / Market Value / Strategy / Sector
- **Trading** — Symbol / Quantity / Avg Cost / Current Price / Today's P&L

**Total P&L** = unrealized + realized and **Total Return %** = Total P&L / cost basis — display-layer arithmetic over existing fields (Moomoo 持仓盈亏), no engine change. Default view = Overview; each view's sort resets to its headline metric. Desktop = segmented control, mobile = horizontal-scroll chips. EN/ZH for the view labels + new column headers.

Scope: only `holdings/page.tsx` presentation, `globals.css` (`.view-switch` / `.sector-cell`), and `dictionary.ts`. Dashboard / Position Hub / Journal / Planner and all portfolio calculations unchanged. Validated by a live UAT against the real 14-position portfolio (Total P&L / Total Return % reconciled exactly). **Tag:** `v5.0.2`.

---

## v5.0.1 — 2026-06-04

Contract-alignment patch (no new features, no redesign):
- **Position Hub** self-fetches quotes on load — direct loads / refreshes now get fresh prices, not the DB snapshot (aligns with the documented Phase 2E behavior).
- **Journal + Planner** stamp quote freshness (`quotesUpdated`) after self-fetch, so the topbar pill no longer reads stale.
- **i18n leakage** fixed — `title` / `aria-label` / tooltip strings (language & theme toggles, FX pill, primary-currency group, allocation view toggle, decision delete) now localize EN/ZH.
- **Docs:** `AGENTS.md` Market Pulse rule updated to match the shipped **dual-row Hot List + marquee** (owner-accepted design; the old "single static row / no marquee" wording was superseded).

Hardcoded-color observations left on backlog. Dashboard layout / ticker / Planner logic / Position Quality / Risk scoring / design system unchanged. **Tag:** `v5.0.1`.

---

## v5.0.0 — 2026-06-04

**Major**
- Position Hub
- Dashboard Attention Layer
- Journal
- Planner

**Result:** Tracker → Decision Operating System.

**Tag:** `v5.0.0` · Phase 2 (intelligence layer) complete & frozen · validated by a real-portfolio UAT (0 P0 / P1).

_Full detail: [`ROADMAP.md`](./ROADMAP.md) · [`docs/PHASE-2-RETROSPECTIVE.md`](./docs/PHASE-2-RETROSPECTIVE.md)._
