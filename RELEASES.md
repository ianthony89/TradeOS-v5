# Releases

_Newest first. Each version is tagged in git._

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
