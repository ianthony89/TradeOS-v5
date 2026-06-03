# Releases

_Newest first. Each version is tagged in git._

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
