@AGENTS.md

# CLAUDE.md — Compatibility Mirror

This file exists for compatibility with Claude Code's auto-loaded `CLAUDE.md` convention.

**The canonical AI operating contract for TradeOS lives in [`AGENTS.md`](./AGENTS.md).**

If anything appears to conflict between this file and `AGENTS.md`, **`AGENTS.md` wins**.

**Current progress / changelog** (so you know where the build stands) → `AGENTS.md` § 2 "Recent changes (newest first)". _Last synced: 2026-06-06 — **Phase 2 architecture FROZEN (tagged `v5.0.0`, last tagged `v5.0.9`); **`v5.1.0` Dashboard Premium Polish IN REVIEW — NOT tagged, NOT frozen, live = `5f56276`** (rounds P1 → P1.4). Owner-directed visual overhaul of the dashboard *skin only*: command header (Hero + KPI 2×2 in one band), Best Position, urgency-sorted **facts-only** Action Center (horizontal priority rows), single-hue Apple risk gauge + natural-language drivers, Portfolio Health = 4 narrative numbers, scrollable Holdings, and a **theme-aware 3-tier hierarchy via elevation tokens (not shadow — the dark-mode fix)**. **Layout is now LOCKED — next work is polish, not rewrite.** Files touched: `dashboard/page.tsx`, `globals.css`, `dictionary.ts` only. **Phase 2 architecture stays FROZEN; NO fabricated intelligence (thesis-broken / AI-confidence / risk-trend) — that's Phase 3. Awaiting owner "Freeze" → tag `v5.1.0` → Phase 3 AI Analysis Engine (do not start without owner go).** Browser visual QA is blind (tab-grouping bug) → owner screenshots + deployed-bundle checks are the QA loop. **⚠ Migration 008 must be applied in Supabase** (holdings.exit_price + exit_date, from v5.0.5).** Repo = `github.com/ianthony89/TradeOS-v5`, deploy = `tradeos-v5.vercel.app` (NOT the legacy `TradeOS` repo). Phase status → `ROADMAP.md`; retrospective → `docs/PHASE-2-RETROSPECTIVE.md`._

For:
- Who Anthony is
- What TradeOS is
- Current progress & changelog (§ 2)
- Dashboard product architecture
- Holdings philosophy
- Financial semantics & FX rules
- Market session taxonomy
- Localization rules
- Frozen vs allowed zones
- Code discipline
- Collaboration protocol
- Multi-AI roles
- Dashboard acceptance criteria
- Project-specific gotchas
- Long-term goals

→ Read [`AGENTS.md`](./AGENTS.md). It is the single source of truth.
