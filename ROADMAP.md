# TradeOS v5 — Roadmap

_Status as of 2026-06-04 · current release **`v5.0.5`** · patch line v5.0.1–v5.0.5 (see [`RELEASES.md`](./RELEASES.md))._

> **⚠ Migration 008 must be applied in Supabase** (`holdings.exit_price` + `exit_date`, added in v5.0.5 for the Closed-Positions "Since Exit %"). The app is resilient without it — those fields show "—" until applied.

TradeOS is a portfolio **decision cockpit**, not a generic tracker. The roadmap
is deliberately conservative: surfaces ship only when they earn their place, and
each is frozen once validated so later work can't quietly regress it.

---

## ✅ Phase 1 — Foundation (complete)

The trustworthy base: get real holdings in, price them live, and present them honestly.

- Auth (email + numeric PIN, invite-only onboarding, admin approval)
- App shell (sidebar / topbar / mobile nav, EN+ZH, light/dark)
- CSV import (Moomoo broker exports, ZH/EN header auto-detect)
- Live quotes (Yahoo primary + Finnhub fallback, Upstash-cached) + USD/MYR FX
- Dashboard (holdings value, market sessions, allocation, risk, movers)
- Holdings (decision workspace + strategy/action taxonomy)
- Watchlist (radar: target / distance / status)
- Settings (theme / language / currency / FX / two-step PIN change)

## ✅ Phase 2 — Intelligence Layer (complete & FROZEN)

Turn the tracker into a decision loop: **detect → review → decide → simulate.**

| Sub-phase | Surface | Role |
|---|---|---|
| 2A | **Position Hub** (`/holdings/[symbol]`) | Decide — thesis, targets, conviction, review, decision log, 5-dim Position Quality |
| 2B | **Dashboard Attention Layer** | Detect — unified Attention Feed + Review Queue |
| 2C | **Journal** (`/journal`) | Review — cross-position review workspace (pulse / queue / history) |
| 2D | **Planner** (`/planner`) | Simulate — read-only Portfolio Action Simulator |
| 2E | **QA + real-portfolio UAT** | Hardening — error surfacing, live-price overlay, FX guard; UAT passed on real data |

**Frozen** = bug fixes only. No new features, redesigns, or sections without an explicit new phase.

## ⏸️ Phase 3 — Not started (awaiting product direction)

No Phase 3 scope is committed. Candidate directions, none authorized yet:

- A real **`/ai` analysis** surface (currently a deferred stub — explicitly off until decided).
- Cross-position **Planner v2** (sector allocation, persisted plans, cash tracking).
- **Alerts / notifications** engine (price + review-due) — DB foundations exist; no UI by decision.
- News / earnings feeds.
- Broker integrations beyond CSV.

> Product direction decides Phase 3. Engineering does **not** start it automatically.

---

## Explicitly deferred (by owner decision)

AI features · alerts/notifications · news & earnings feeds · Planner sector mode · plan/cash persistence. DB foundations may exist, but **no user-facing UI** ships for these until a phase opens them.
