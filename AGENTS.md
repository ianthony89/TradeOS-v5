<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# AGENTS.md — TradeOS v5 AI Operating Contract

> **This repository uses AGENTS.md as the canonical AI operating contract.**
> `CLAUDE.md` exists as a compatibility mirror for Claude Code's auto-load convention.
> **If conflicts exist between any document, AGENTS.md wins.**

This file is read by every AI assistant (Claude, ChatGPT, Codex) at session start.
Calibration target: **95%+ alignment** between AI assumptions and Anthony's product intent.

---

## § 1. About Anthony

**Anthony Cody** is a **product owner and solo builder** based in Malaysia.

He understands:
- Product architecture
- UX design and visual semantics
- Financial product semantics (P/L, exposure, risk, FX)
- The trading domain (he is an active trader: US equities, Bursa Malaysia, crypto, leveraged ETFs)

He is **not the implementation engineer**. He does not write production code.

### Communication priorities

When responding to Anthony, lead with:
1. **Product impact** — what changes for the user?
2. **Architectural decisions** — what trade-offs?
3. **Tradeoffs** — what alternatives were considered, why this one?
4. **Risks** — what could break, what's the blast radius?

### What NOT to do

- ❌ Do not assume Anthony will manually debug a stack trace
- ❌ Do not dump raw error logs without translating the impact
- ❌ Do not ask Anthony to choose between technical implementations without explaining the user-facing difference
- ❌ Do not invent fake humility ("I don't understand code") — Anthony understands enough to verify your reasoning. He just doesn't write the code.

### Communication style

- **Conclusion first**, then reasoning
- Technical terms (`API`, `TypeScript`, `Supabase`, `useEffect`) are fine — Anthony tracks them
- Mixed Chinese/English is natural — code/notation in English, casual/emotional moments in Chinese ("哥", "你看可以吗")
- Anthony **rewards pushback**. If his plan has a flaw, flag it before executing.

---

## § 2. About TradeOS v5

### Identity

**TradeOS v5** is a **premium portfolio operating system** — Anthony's personal trading dashboard, designed for eventual public release to other individual traders.

### Audience

- **Today**: Anthony's personal use + small private circle (friends, invite-only)
- **Tomorrow**: Public release to individual traders worldwide

This means: **do not assume only Anthony will see this UI**. A new trader should understand the dashboard in 5 minutes without explanation.

### Tech stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Database**: Supabase (Postgres + Auth + RLS)
- **State**: Zustand stores (`holdings`, `market`)
- **Styling**: Tailwind 4 + project's own design token system in `globals.css`
- **Market data**: Yahoo Finance (primary) + Finnhub (fallback) via Upstash Redis cache
- **CSV import**: Moomoo broker exports (ZH/EN auto-detect headers)

### Auth model

- Email + numeric PIN (4–8 digits)
- PIN is the Supabase password (server-side bcrypt, never client-hashed)
- No traditional password concept exposed to users

### Currency model

- USD + MYR dual currency
- FX rate is a **reference tool**, not auto-magic. See § 6.

### Current phase

**Status: Phase 2 COMPLETE, real-portfolio UAT PASSED, v5 FROZEN.** Phase 2A (Position Hub) + 2B (Dashboard Attention Layer) + 2C (Review Hub / Journal) + 2D (Planner) all live & frozen; Phase 2E QA + a live UAT against the real 14-position portfolio are closed (0 P0/P1; 3 P2 fixed). _Last updated: 2026-06-04._

> **Repo + deploy (corrected 2026-06-04):** the Next.js v5 app lives at **`github.com/ianthony89/TradeOS-v5`** (deployed at **`https://tradeos-v5.vercel.app`**). The older `github.com/ianthony89/TradeOS` holds the **legacy vanilla HTML/CSS/JS** app only (do not push v5 there). Earlier in development, v5 commits appeared to push to `TradeOS` but were sandbox-intercepted and never landed; the history was moved to the dedicated `TradeOS-v5` repo and Vercel re-pointed. Tagged **`v5.0.0`**; phase status in [`ROADMAP.md`](./ROADMAP.md), full retrospective in [`docs/PHASE-2-RETROSPECTIVE.md`](./docs/PHASE-2-RETROSPECTIVE.md).

Shipped surfaces:
- Auth (login / register / forgot PIN / reset PIN / pending approval)
- App shell (sidebar / topbar / mobile nav)
- Dashboard (intelligence-first cockpit + **Attention Layer**, Phase 2B) — current panel set in § 4. The **Attention Layer** = a unified **Attention Feed** (price + review-due + missing-thesis/targets on the Top-5 by weight + watchlist-triggered, prioritized, capped 5, one item per position) and a **Review Queue** (full review schedule, overdue→due→soon). Every item deep-links into the Position Hub (`/holdings/[symbol]`; watchlist triggers → `/watchlist`). Engine `lib/portfolio/attention.ts` (rules-based, no AI) replaced the old `action-center.ts`. **Dashboard = Attention Layer; Position Hub = Decision Layer. FROZEN — bug fixes only.**
- Holdings (decision workspace)
- **Position Hub** (Phase 2A — per-position intelligence at `/holdings/[symbol]`): Hero, Overview, Investment Thesis (10 starter templates + sentence-based **Strengthen Thesis** building blocks that append), Target Planner (price ladder), Decision Log, plus **lightweight** Conviction (hero badge) + Review Schedule (cadence chips). **Position Quality** = a frozen **5-dimension** completeness grade — Investment Thesis · Target Plan · Decision Log · Conviction · Review Schedule → A+/A/B/C/D, rendered as a `Complete:` ✓ list + `Missing:` • list. Client-Supabase + RLS via `position_intelligence` + `journal_entries` (**migration 007 must be applied** or Conviction/Review won't persist). **This surface is FROZEN — bug fixes only, no redesigns, no new sections.**
- **Journal / Review Hub** (Phase 2C — `/journal`, the Review Workspace): **Review Pulse** (overdue / due-this-week / on-schedule / not-scheduled counts) + **Review Queue** (compact rows `symbol · status · muted quality grade`, grouped Overdue→Due→Soon; expand → thesis + targets-vs-price + last reviewed; **Mark Reviewed is gated on choosing the next cadence**, note optional → advances `next_review_at` + logs the note; **Open Hub is the primary CTA**) + **Review History** (last 50 logged decisions, each with the position's current return). Untracked positions can be put on a cadence inline. **Schedule-only** — reuses `position_intelligence` + `journal_entries`, no new tables. **Dashboard = Detect · Journal = Review · Position Hub = Decide. FROZEN.**
- Watchlist (radar system — symbol / target / distance / status, persisted to `watchlist_items`)
- **Planner** (Phase 2D — `/planner`, a read-only **Portfolio Action Simulator**): one page, three stacked cards. **Add Capital** (enter cash → deploy by *Current portfolio* = proportional, or *Strategy target* = toward Core/Tactical/Spec gaps). **Reduce Concentration** (position + direct target % → sell value / shares / cash freed / new weight). **Target Allocation (Strategy)** (editable Core/Tactical/Spec targets, default 50/30/20 → current mix + gap + Buy/Trim/Hold, with a plain-English suggested-action block). Pure deterministic math in `lib/portfolio/planner.ts` (mirrors strategy bucketing so the frozen Dashboard isn't touched); reuses holdings + FX + `classifyStrategy`. **No execution, no writes, no persistence, no new tables, no AI, no Sector mode (v1). FROZEN.**
- Settings (theme / language / currency / manual+live FX / **two-step Change PIN**: verify old → set new)
- Admin (invite-only onboarding: generate single-use codes + approve users + members list)
- Market intelligence (live sessions, FX, sync indicators)

**Phase 2A** — ✅ DONE & frozen: Position Intelligence Hub.
**Phase 2B** — ✅ DONE & frozen: Dashboard Attention Layer (Attention Feed + Review Queue).
**Phase 2C** — ✅ DONE & frozen: Review Hub / Journal (Review Workspace at `/journal`).
**Phase 2D** — ✅ DONE & frozen: Planner (Portfolio Action Simulator at `/planner`).
**Phase 2 (remaining)** — Only `/ai` is left as a "Coming soon" stub, and it is **explicitly deferred by owner decision** (no AI features). AI analysis, news/earnings feeds, and an alert engine remain deferred (DB foundations OK; no new user-facing UI). The `/ai` roadmap card stays an honest "Coming soon" — NOT a fake shell. Do not populate it with invented data or fake panels.

### Recent changes (newest first)

Audit trail of the last sprint (latest commits on `main`). For an auditor: this is where the dashboard actually stands today.

- **2026-06-04** — **v5.0.2 — Holdings multi-view (presentation-only).** The single all-in-one Holdings table became four focused lenses behind a segmented view switch: **Overview** (Value/Weight/Today P&L/Total P&L), **Performance** (Unrealized P&L/Unrealized %/Realized P&L/Total P&L/Total Return %), **Allocation** (Weight/Value/Strategy/Sector), **Trading** (Qty/Avg Cost/Price/Today P&L). Default = Overview; sort resets to each view's headline metric. A column registry (`COLUMNS` + `VIEWS`) drives header+cells; new **display-derived** `totalPl = unrealizedPl + realizedPl` (Moomoo 持仓盈亏) + `totalReturnPct = totalPl / costBasis` — **no engine/DB/migration/API/calc change.** Desktop = segmented control, mobile = horizontal-scroll chips (`@media ≤640px`). EN/ZH. Owner-approved UX enhancement (reduce cognitive load, Moomoo parity); Holdings is **not** a frozen Phase-2 surface, so this is in-scope. The `Action` taxonomy column is no longer surfaced on Holdings (Strategy still shown in Allocation). Touched only `holdings/page.tsx` + `globals.css` (`.view-switch`/`.sector-cell`) + `dictionary.ts`. Live UAT on the real 14-position portfolio reconciled Total P&L / Return exactly. `7d573ef`. **Tag:** `v5.0.2`.
- **2026-06-04** — **Phase 2 CLOSED. Real-portfolio UAT passed on the live app (14 positions).** All four modules validated against real data: Position Hub (thesis/targets/conviction/review persist → A+ quality), Journal (007 applied, review history logging, queue), Planner (Add-Capital proportional sums to cash; Target-Allocation gap math exact), Dashboard (Attention Feed accurate, prioritized). **0 P0/P1.** Three P2s fixed `d54db55`: (1) `computeWatchStatus` now returns **WATCHING** when there's no usable price (`current<=0`) instead of a false **NEAR_TARGET**; (2) Dashboard Review-Queue empty copy → *"No reviews due right now"* (was the misleading *"No reviews scheduled"*). (3) **Cross-page weight drift is EXPECTED, not a bug** — each page (Dashboard / Hub / Planner / Journal) self-fetches its own `/api/quotes` snapshot at load, so weights observed minutes apart drift with the live market; pages are each internally fresh + consistent, freezing them to one shared timestamp would only make them stale, so **behavior is left unchanged by design** (no shared-snapshot complexity added).
- **2026-06-04** — **Repo migration:** v5 history moved to its own repo `github.com/ianthony89/TradeOS-v5` (deploy `tradeos-v5.vercel.app`); legacy vanilla app stays on `ianthony89/TradeOS`. Phase 2E QA fixes (`25ea10a`, `1b74502`) + P2 fixes (`d54db55`) are on it.
- **2026-06-03** — **Planner (Phase 2D) shipped & FROZEN.** The `/planner` "Coming soon" stub became a read-only **Portfolio Action Simulator**: one page, three stacked cards — Add Capital (Current-portfolio proportional OR Strategy-target gap deployment), Reduce Concentration (sell value / shares / cash freed / new weight), Target Allocation by strategy (editable Core/Tactical/Spec, default 50/30/20, current mix + Buy/Trim/Hold gap), each with a plain-English suggested-action block. New pure lib `planner.ts`; reuses holdings + FX + `classifyStrategy`; widened `PanelHead` title to `ReactNode`. No execution / writes / persistence / new tables / AI; no Sector mode in v1. EN+ZH. `ef5f7fd`, `adb195c`.
- **2026-06-03** — **Review Hub / Journal (Phase 2C) shipped & FROZEN.** The `/journal` "Coming soon" stub became the **Review Workspace**: Review Pulse + Review Queue (compact rows expand to thesis/targets/last-reviewed; Mark Reviewed gated on choosing the next cadence, note optional → advances `next_review_at` + logs the note; Open Hub is the primary CTA) + Review History (last 50 decisions, each with the position's current return). Untracked positions can be scheduled inline. New read-only `loadRecentDecisions` bulk loader + shared `position-quality.ts` (mirrors the frozen Hub grade). Schedule-only (no price/watchlist/risk/dashboard signals); reuses `position_intelligence` + `journal_entries`; no new tables, no AI, no alerts. EN+ZH. `c544059`, `f507f85`.
- **2026-06-03** — **Dashboard Attention Layer (Phase 2B) shipped & FROZEN.** New rules-based engine `lib/portfolio/attention.ts` (no AI) fuses price + review-due + missing-thesis/targets (Top-5 by weight) + watchlist-triggered into one prioritized **Attention Feed**; a **Review Queue** lists the full schedule (overdue→due→soon) with an explicit "Review →" CTA. Every item deep-links into the Position Hub (`/watchlist` for unowned watch triggers). Replaced the price-only `action-center.ts` (deleted); added `loadAllPositionIntel` bulk loader + shared `review-status.ts` (Hub kept its frozen inline copy); `IntelCard` gained a deep-link href. Polish: 60/40 split, neutral cards with a thin left accent (reduced color noise), terse `{symbol} · issue` copy. EN+ZH. Hero/Allocation/Risk/Movers/Holdings untouched. `24f60c2`, `5a1c13e`.
- **2026-06-02** — **Position Hub (Phase 2A) finalized & FROZEN.** Position Quality became a **5-dimension** `Complete:` / `Missing:` readout on its own hero line — added **Decision Log** as a tracked dimension; grade rebased to 5=A+, 4=A, 3=B, 2=C, ≤1=D `472cd44`. **Strengthen Thesis** building blocks are now **complete sentences that append** to the thesis (never keyword chips, never overwrite) `53a46c3`. Thesis library expanded to **10 production-ready starter templates** (Growth · Compounder · Value · Dividend · Turnaround · Speculation · ETF · Cyclical · AI Theme · Small Cap), each 80–90% pre-written across Why/Bull/Bear/Invalidation, EN+ZH `50318fe`, `10cdecf`. Owner kept Conviction + Review Schedule (lightweight) so positions can reach A+, then **froze the whole Position Quality model + Position Hub** (bug fixes only).
- **2026-06-01** — Allocation **finalized: Donut (default) + ranked List**. Sunburst & Treemap were trialled and **removed** (too many edge cases); the `StarItem` type now lives in `donut-chart.tsx`. The diversification footer shows on the **List only** (it unbalanced the donut). `bf33553`, `4ce21e1`.
- **2026-05-31** — **Diversification footer** on the List: "effective sectors" (inverse Herfindahl index) + verdict pill (Concentrated / Balanced / Diversified) + top-2 concentration read. Pins to the panel bottom, mirrors the Risk "Suggested actions" box. `d064cc4`.
- **2026-05-31** — **🔑 Live FX fixed** (the long-standing "Live rate won't update" bug). Root cause was a `yahoo-finance2` v3 API change that silently broke every Yahoo quote — full detail in § 15. This also restored Malaysian `.KL` quotes. `bef7b8f`.
- **2026-05-31** — **Risk Assessment** polish: factor bars (Concentration / Speculative / Broken theses) and strategy bars (CORE / TACTICAL / SPECULATIVE) now **glow + show a plain-language calc on hover**; unified bar spacing; readable centred `InfoTooltip` with an `align` prop. `573074c`, `1fc121b`, `e669a0d`, `b54dcd0`.
- **2026-05-31** — **Ranked allocation List** introduced + distinct per-sector colour palette. The "Stars / Portfolio Galaxy" starfield experiment was tried and dropped. `a64e02d`, `d6458e0`, `61cc874`.
- **2026-05-30/31** — **Full EN/ZH i18n sweep** across Dashboard, Holdings, Watchlist, Settings, FX/Sync pills, sector names, a stock-name map (`lib/portfolio/stock-names.ts`), and localized relative timestamps. `355841a`, `bb8d61d`, `cd6d7ab`.

### Deployment

- **Live**: `https://tradeos-v5.vercel.app` (Vercel, auto-deploys on push to `main`)
- **Repo**: `github.com/ianthony89/TradeOS-v5` — the Next.js v5 app. (The separate `github.com/ianthony89/TradeOS` is the legacy vanilla HTML/CSS/JS app — NOT this codebase. Do not push v5 there.)
- **Env vars** live in Vercel (7 keys; see `DEPLOY.md`). `.env.local` is gitignored and never committed.
- After any push to `main`, Vercel redeploys in ~1–2 min.
- ⚠️ **Pushing from this sandboxed shell can silently no-op** — `git push` may report success while the bytes never reach GitHub. Always verify with `git ls-remote origin main` that the remote SHA matches local; if not, re-push with the sandbox disabled.

---

## § 3. Design Language

### Target feel

TradeOS v5 is a **premium fintech OS**.

References: **Apple Finance** × **Linear** × **Robinhood Gold** × **premium trading workstation**.

### Required attributes

1. **Apple-grade liquid glass material**
   - Real multi-layer composition: `tint + blur(28px) saturate(180%) + inset specular + inset shadow + outer shadow + hairline border`
   - Not cheap `backdrop-filter: blur(12px)` glassmorphism

2. **Deep navy base** (`#0a0f1f` family)
   - No animated ambient blob backgrounds
   - No grid texture overlay
   - All depth comes from layered glass surfaces

3. **Restrained palette**
   - Primary: Blue (`--accent`)
   - Secondary: Subtle purple (`--accent-2`)
   - Semantic: Emerald positive / Rose negative / Amber warning
   - No cyan-heavy crypto vibe

4. **Strong financial typography**
   - Tabular nums (`font-variant-numeric: tabular-nums`) on every numeric cell
   - Hero values: 32–36px / weight 700
   - Information density is acceptable when calmly composed

5. **Dual theme — true parallel architecture**
   - Separate `:root` and `[data-theme="light"]` token blocks
   - Not dark-inversion hacks
   - Both modes must be production quality

### Anti-patterns (do NOT do these)

| ❌ Anti-pattern | Why we reject it |
|---|---|
| v3 retro command center (accent bar before titles, stat hover lift, animated blobs, grid texture, scrolling marquee) | Looks dated and cluttered |
| v4 cyberpunk glow stack (drop-shadow glow everywhere, oversaturated blue/purple) | Looks cheap, like a budget crypto exchange |
| Generic SaaS minimalism (Notion-grade, low density, no product personality) | Loses trading product DNA |
| Fake Bloomberg cosplay (low contrast retro, packed cockpit) | Not modern, not premium |
| Fake intelligence panels (Threat Engine, AI Lab without working logic) | Dishonest UX |

### Trading intelligence > visual minimalism

Beautiful UI matters, but information clarity wins ties.

**TradeOS is a trader product, not a design showcase.** A clean dashboard that hides P/L is a worse product than a slightly busier one that surfaces P/L clearly.

---

## § 4. Dashboard Product Architecture

The dashboard is a **portfolio decision cockpit**, not a generic SaaS analytics screen.

**Required hierarchy** (top to bottom):

### 1. Top intelligence bar (in topbar)
- Greeting (time-aware: "Good morning", "Good late night", etc.)
- Today's date
- Position count
- **Live local time with seconds** (ticks every 1s)
- Market session pills (MY + US, live)
- FX reference pill (USD/MYR)
- Quote freshness pill (e.g., "Quotes 2m ago")
- Language toggle
- Theme toggle

### 2. Market pulse strip — **dual-row scrolling marquee (accepted v5 design, owner-approved 2026-06-04)**
- **Two animated rows:** a curated **Hot List** (`lib/market/hot-list.ts`, scrolls ←) over **My Holdings** (one chip per held position, scrolls →). Component: `ticker-strip.tsx`; CSS marquee in `globals.css`.
- Each chip: logo + symbol + price + delta + currency, with an edge-fade mask.
- **This is a deliberate product choice — do NOT** revert to a single static row, remove the Hot List, or strip the marquee animation. (An earlier draft of this rule read "held positions only / static / no marquee"; that was **superseded** by the shipped design and is no longer the contract.)

### 3. Hero portfolio summary
- **Primary currency toggle** between USD and MYR (user picks)
- Selected currency rendered LARGE (36px / weight 700)
- Converted currency rendered SECONDARY (16px / muted)
- Today's delta inline (P/L money + %, color-coded)

**Critical naming rule (see § 8)**:
- If user has not entered cash balance → label as **"Holdings Value"** (NOT "Total Value")

### 4. Intelligence zone
Real intelligence modules — render only when triggered or relevant:
- **Concentration risk** alerts (any position > 25% of portfolio)
- **Heavy loss** alerts (any position < −50%)
- **Sector concentration** alerts (any sector > 70%)
- **Sector allocation** — two views via the header swap control: **Donut** (default) and a ranked **List** (sector spectrum bar + sorted bars + Sectors/Holdings toggle + diversification footer). `allocation-views.tsx` routes the views; `donut-chart.tsx` + `allocation-list.tsx` render them. Sunburst & Treemap were trialled and removed — **do not re-add without asking**.
- **Risk Assessment** — composite 0–100 score `= 0.40·concentration + 0.35·speculative + 0.25·drawdown` (`lib/portfolio/risk-score.ts`). Renders factor bars (hover = glow + plain-language calc), a strategy split (CORE / TACTICAL / SPECULATIVE), and a "Suggested actions" box. Strategy/factor classification lives in `lib/portfolio/taxonomy.ts`.
- **Top movers** (capped: 3 gainers + 3 losers by unrealized %)

**No fake panels.** If no data → empty state with honest message.

### 5. Holdings preview
- Top **6** positions by weight (intentional cap — not 8, not unlimited)
- Compact actionable view
- Link "View all →" to full Holdings page

---

## § 5. Holdings Philosophy

Holdings is a **decision workspace**, not a CRUD spreadsheet.

### Each row must answer:

| Question | Visual answer |
|---|---|
| What do I own? | Logo + symbol + name + currency |
| What's my exposure? | Market value + portfolio weight % |
| Am I winning or losing? | Today P/L + total P/L (money + %), color-coded |
| What action is implied? | Strategy badge + Action badge (Hold / Add / Reduce / Exit) |

### Principles

- **Signal > decoration.** Every column carries trading signal.
- **Visual hierarchy matches importance**: market value and P/L are louder than quantity.
- **Color earns attention**: strong wins (`>+25%`) get subtle emerald row tint; strong losses (`<−25%`) get subtle rose row tint.
- **Taxonomy is computed**, not user-edited: `CORE / TACTICAL / SPECULATIVE` strategy class + `HOLD / ADD / REDUCE / EXIT` action class, both derived from existing data in `lib/portfolio/taxonomy.ts`.

---

## § 6. Financial Semantics & FX Philosophy

Financial labels must be **semantically honest**. Misleading labels harm trader trust.

### Holdings Value vs Total Value (Product Truth Rule)

| User state | Label | Reasoning |
|---|---|---|
| Cash balance unknown / not entered | **"Holdings Value"** | We only know what's invested, not total wealth |
| Cash balance entered | **"Total Portfolio Value"** or **"Net Worth"** | We can compute total honestly |

**Default state for TradeOS Phase 1: "Holdings Value"** (cash module not built yet).

Do NOT say "Total Value" if you don't actually know the total. Trader trust is built on accurate labels.

### FX Philosophy

- **Default rate**: USD/MYR = `4.00` (manual reference baseline) — DONE
- **Manual override**: editable in Settings AND via click-to-edit popover on the topbar FX pill — DONE
- **Live sync**: opt-in via Settings; `useFxRateSync()` only fetches when mode = live — DONE (confirmed working 2026-05-31 after the `yahoo-finance2` v3 provider fix; see § 15)
- FX is a **reference tool**, not hidden auto-magic. The pill shows a `manual`/`live` indicator.

### FX invariance decision (resolved 2026-05, option A — keep)

The portfolio USD total **does** move when FX changes — by design. This is correct:
a MYR-native holding (e.g. SUNMED) is valued `MYR ÷ FX`, so a stronger MYR raises its
USD value. Worked example: RM 350 ÷ 4.00 = $87.50 vs ÷ 3.92 = $89.29 (+$1.79).

- USD-native holdings are FX-invariant; only the MYR→USD conversion moves.
- Do NOT "fix" this — it's real currency exposure. Anthony chose to keep it (option A).
- A deferred option B (freeze MYR holdings to a USD value at import) is a Phase-2
  cash/valuation decision, not a bug fix.

**Consistency rule**: every monetary metric (Holdings Value, Today P/L, Unrealized) is
first reduced to a USD-equivalent base (`usdEquiv`), then converted to the active
display currency together. Never display a raw mixed-currency sum.

### Currency Primary / Secondary

| Hero shows | Secondary displays |
|---|---|
| USD primary | MYR conversion |
| MYR primary | USD conversion |

User can toggle primary currency. Default: USD.

---

## § 7. Market Session Taxonomy

Define **explicit states** for each market. Do not invent vague labels.

### Malaysia (Bursa Malaysia)

| Session | Time (MYT) | UI label |
|---|---|---|
| pre-open | 08:30–09:00 | "Pre-open" |
| morning | 09:00–12:30 | "Morning" |
| lunch break | 12:30–14:30 | "Lunch break" |
| afternoon | 14:30–17:00 | "Afternoon" |
| closed | otherwise + weekends | "Closed" |

### US (NYSE / NASDAQ)

| Session | Time (ET) | UI label |
|---|---|---|
| premarket | 04:00–09:30 | "Pre-market" |
| regular | 09:30–16:00 | "Regular Hours" |
| after-hours | 16:00–20:00 | "Post-market" |
| overnight | 20:00–04:00 + weekends | "Overnight" |

### Future markets (extensibility)

- **HK (HKEX)** — partial implementation exists. Morning 09:30–12:00 / Lunch 12:00–13:00 / Afternoon 13:00–16:00
- **SG (SGX)** — to add: 09:00–17:00 with optional pre-open

Add new markets by extending `lib/market/market-hours.ts`. Use the same explicit state model — no invented vague labels.

---

## § 8. Localization Rule

**Strict rule**: UI must be coherently single-language at any moment.

| UI language setting | Then ALL of these must be: |
|---|---|
| English (`en`) | All labels, buttons, headings, microcopy in English |
| Chinese (`zh`) | All labels, buttons, headings, microcopy in Chinese |

**No mixed-language UI.**

### What this means in code

- Every visible string must come from `lib/i18n/dictionary.ts` via `useT()`
- Both `en` and `zh` dictionaries must have parallel keys
- When adding a new English label, you MUST add the Chinese equivalent in the same commit

### What's exempt

- Brand name "TradeOS" (proper noun)
- Stock tickers and company symbols
- Currency codes (USD, MYR)
- Unit symbols (%, $, RM)

---

## § 9. Frozen vs Allowed Zones

### 🔒 FROZEN — do not modify without explicit permission

Backend layer is treated as a stable contract:

- `src/app/api/**` — all API routes
- `src/lib/supabase/*` — Supabase clients
- `src/lib/market/{cache,market-router,symbol-normalizer,asset-type,types}.ts`
- `src/lib/market/providers/*` — Yahoo / Finnhub providers
- `src/lib/utils/csv-parser.ts` — Moomoo CSV parser
- `src/stores/holdings.ts` — primary holdings store
- `src/proxy.ts` — Next.js 16 middleware
- `supabase/migrations/0*` — already-applied migrations (new files are OK, but must be idempotent)

To modify these: **stop, explain, propose, wait for Anthony's approval.**

### 🟢 ALLOWED — modify freely (still with discipline)

- `src/app/**/*.tsx` — pages
- `src/components/**` — UI primitives, brand, layout
- `src/app/globals.css` — design tokens, glass material, components
- `src/lib/utils/*` (except `csv-parser.ts`)
- `src/lib/portfolio/*` — client-side classification (taxonomy, sectors)
- `src/lib/hooks/*` — React hooks
- `src/lib/market/market-hours.ts` — frontend session detection logic
- `src/lib/i18n/*` — add dictionary keys (do not restructure)
- New `src/stores/*.ts` files (but do not modify existing `holdings.ts`)

---

## § 10. Code Discipline

### 10.1 Think first, then code
- State assumptions explicitly
- Multiple valid interpretations? List them all, let Anthony pick
- Simpler approach available? Say so, even if it contradicts the request
- Stuck? Stop, explain, ask. Do not silently guess.

### 10.2 Simplicity preferred
- Minimum code to solve the problem. No "just-in-case" code.
- No features Anthony did not ask for
- No flexibility / config options without a current need
- Self-check: "Would a senior engineer find this overengineered?" → if yes, simplify

### 10.3 Surgical changes
- Only touch what needs touching
- Do not "tidy" adjacent code, comments, or formatting
- Do not refactor things that work
- Match existing code style (indentation, import order, naming) even if you would write it differently
- Found unrelated dead code? **Report it. Do not silently delete.**
- Clean up imports / unused vars you yourself introduced

### 10.4 No hardcoded colors
- All colors through CSS variables (`var(--accent)`, `var(--positive)`, etc.)
- **Only exception**: country flag SVGs in `flags.tsx` — those are official national colors and must be literal hex

### 10.5 No fake placeholder data
- Dashboard / Holdings numbers must come from Supabase + live quotes
- No data? Show an honest empty state, not invented numbers
- Phase-2 placeholder pages must clearly say "Coming soon" — they are honest claimed nav slots, not fake feature shells

### 10.6 Responsive from day one
- Desktop + mobile + tablet must all work
- Use the project's standard breakpoints: `1280 / 1100 / 900 / 720 / 640`
- Sidebar collapses to mobile-nav below 900px

### 10.7 Error handling (calibrated, not extreme)

**Avoid speculative defensive over-engineering** — do not wrap every line in try/catch "just in case."

**Add realistic error handling where user impact is meaningful**:
- Network failures (quotes / FX / CSV upload) → graceful fallback + user-visible message
- Auth failures → clear error message in the auth form
- Data integrity issues (NaN, missing fields) → safe default, not a crash

The test: would a normal user see a confusing failure if this fails? If yes → handle it. If no → don't.

---

## § 11. Collaboration Protocol

### Hard rules

1. **Do not auto-commit.** Anthony decides when to commit. After changes, report: files changed, why changed, risks.
2. **Ask before irreversible operations**: deleting migrations, modifying Supabase schema, changing auth flow, deleting prod data.
3. **Quality gate before handoff**:
   ```
   npx tsc --noEmit        # Must be 0 errors
   npm run lint            # Must be 0 errors (4 pre-existing warnings in untouched provider files are OK)
   ```
4. **Do NOT use PowerShell to write files containing Unicode** — `Set-Content -Encoding UTF8` in Windows PowerShell 5.1 double-encodes characters like `·` `→` `⌫`. Use the `Edit` tool, or `[System.IO.File]::WriteAllText(path, content, new UTF8Encoding(false))`.
5. **Mockup-first for visual changes** — offer 1–2 design options before full implementation when the change is large or ambiguous.
6. **Full-send for code-only refactors** — when Anthony approves a plan, execute end-to-end without mid-stops. But stop for **high-risk decisions** (architectural changes, file deletions).

### Communication

- **Conclusion first**, then reasoning
- Report format: **what files / why / risks**
- **Push back when wrong** — if Anthony's plan has a flaw, say "I disagree because X" before executing
- Ambiguous requirements → clarify, do not silently assume

---

## § 12. Multi-AI Roles

Anthony coordinates between multiple AI assistants. Each has a primary lane:

| AI | Primary role | Strengths |
|---|---|---|
| **Claude** (this assistant) | Implementation-heavy execution | Long context, careful code writing, design system work |
| **ChatGPT** ("阿chat哥") | Product architect / debugger / auditor | Quick reasoning, product framing, design critique |
| **Codex** | Repo-aware coding / audit / fixes | Repo-wide understanding, code review |

### Cross-AI etiquette

- **Respect prior project decisions** documented in this file
- When Anthony says "ChatGPT told me to ..." → that is **direction input**, not an order to override existing architecture without discussion
- When Anthony asks one AI to **review another AI's code** → review-only. Report findings. Do not silently rewrite.
- **Final decision** always belongs to Anthony, not any AI

---

## § 13. Anthony's Working Style

Calibrate behavior to Anthony's actual style:

- **Visually picky** — pixel-level polish matters; "good enough" is rejected
- **Product obsessive** — semantics, naming, hierarchy matter, not just decoration
- **Hates fake UX** — placeholder data, mock panels, generic-SaaS chrome will be called out
- **Iterative** — expect course corrections; the first attempt is rarely final
- **Opinionated** — has clear preferences on design and product; respect them
- **Wants pushback, not blind obedience** — challenge ideas early, do not silently execute flawed plans
- **Premium polish first** — quality matters more than speed
- **Honest semantics** — financial labels, currency display, time labels must mean what they say

### When something feels wrong

**Challenge it early.** Surfacing concerns before implementation is rewarded. Surfacing them after the work is done feels like making excuses.

---

## § 14. Dashboard Acceptance Criteria

Use these as the checklist when shipping or reviewing dashboard work.

| Criterion | Required |
|---|---|
| Live clock with seconds visible in topbar | ✅ |
| Market session state visible (MY + US) | ✅ |
| FX rate visible (with manual / live distinction) | ✅ |
| Quote freshness indicator visible | ✅ |
| No mixed-language UI at any time | ✅ |
| "Holdings Value" labeling honest (not implying net worth) | ✅ |
| Top movers intentionally capped (not unlimited spam) | ✅ |
| Intelligence panels only render with real data | ✅ |
| Premium glass material (not cheap glassmorphism) | ✅ |
| Information density without clutter | ✅ |
| Dark + Light both production quality | ✅ |
| Mobile + Desktop both work | ✅ |

---

## § 15. Project-Specific Gotchas

| Area | Gotcha | Avoidance |
|---|---|---|
| **Legacy DB tables missing columns** (the #1 recurring bug) | The live Supabase DB was seeded from a template; `CREATE TABLE IF NOT EXISTS` skipped pre-existing tables, so columns are missing piecemeal. Confirmed missing in production at various points: `holdings.name`, `holdings UNIQUE(user_id,symbol_normalized)`, `invite_codes.used_at/used_by/created_by`, `profiles.email` (NOT NULL, broke signup). | Symptom is always `column X does not exist` or "Database error saving new user". **Root fix**: run `supabase/migrations/003 → 004 → 006` in full (idempotent) to align everything. Surface the real DB error (`detail`/`code`) in API 500s so the missing column is visible. |
| Pre-auth Supabase reads | `validate-invite` and `pin-len` run BEFORE the user is authenticated; RLS blocks anon reads | Use the **service-role admin client** server-side (bypasses RLS) for any pre-auth lookup. Never the session/anon client. |
| Admin routes | `/api/admin/*` use service-role (bypass RLS) | Every admin route MUST call `requireAdmin()` (verifies caller's own `profiles.is_admin`) and 403 before any privileged work. |
| `handle_new_user` trigger | Auto-creates the profile row on signup; `profiles.email` is NOT NULL | The trigger MUST insert `email = new.email`; missing it → "Database error saving new user". |
| Migrations | Archived migrations live in `supabase/migrations/archive/` — do not run them | Active migrations are whatever exists in `supabase/migrations/` root |
| Symbol normalization | Pure-numeric tickers like `5555` need `currency=MYR` to map to `.KL` correctly | `lib/market/symbol-normalizer.ts` handles this, but CSV imports must include currency column |
| Stock logos | Parqet CDN returns 404 for some tickers (especially MY/HK) | `<StockLogo>` falls back to letter avatar via `onError` |
| FX rate | Manual default 4.00; live sync opt-in via Settings (done) | `useFxRateSync` only fetches in live mode. Read the active rate via `selectActiveFxRate`. |
| **`yahoo-finance2` v3 API** (the market-layer landmine) | v3's default export is a **class**, not the v2 singleton. The provider must `new YahooFinance()` first — calling `yahooFinance.quote()` on the bare import throws *"Call `const yahooFinance = new YahooFinance()` first"* at **runtime**, which silently killed **every** Yahoo quote (US equities survived only via the Finnhub fallback; FX `USDMYR=X` and Bursa `.KL` names have no fallback, so they failed — this **was** the "Live FX won't update" bug). | `yahoo-provider.ts` now constructs `new YahooFinance({ suppressNotices: ['yahooSurvey'] })` once at module load (fixed 2026-05-31, `bef7b8f`). Do NOT revert to the singleton import. **`tsc` passes either way** — the failure is runtime-only, so verify with a real quote, not just typecheck. |
| Quote refresh cache | `/api/quotes` caches 5 min in Redis; without `skipCache` a manual refresh returns stale prices (only the timestamp moves) | Manual "Refresh Quotes" buttons send `skipCache: true`. (Closed prices still won't move — that's real, not a bug.) |
| Theme | Persisted to `profiles.theme` in Supabase | On toggle, `await` the update before considering it persisted |
| Login cache | localStorage keys: `tradeos:last_email`, `tradeos:last_pin_len` | Sign-out does NOT clear cache (intentional UX); "Use different account" link clears |
| React 19 lint | `react-hooks/set-state-in-effect` is a new rule | For legitimate localStorage hydration, wrap with `/* eslint-disable react-hooks/set-state-in-effect */` block |
| Sync indicator | Any successful `/api/quotes` call must `setQuotesUpdated(new Date())` | Otherwise topbar's `SyncPill` stays in "idle" |
| PowerShell + Unicode | `Set-Content -Encoding UTF8` corrupts characters like `·` `→` `⌫` | Use `Edit` tool, or `[System.IO.File]::WriteAllText` with `new UTF8Encoding(false)` |

---

## § 16. Long-term Goals

TradeOS v5 is being built to **ship to other individual traders**.

- **Short-term**: Personal use + small private circle (invite-only)
- **Long-term**: Public release for individual traders worldwide

### Implications for every decision

- **Don't assume only Anthony will see this** — a stranger trader must understand the UI in 5 minutes
- **Sustainable abstractions** — if a piece of logic might be reused, extract it cleanly (taxonomy, sectors, format helpers are good examples)
- **Avoid Phase-1 hacks that block Phase-2** — if a quick solution will hurt future features, flag it
- **Anthony's domain knowledge ≠ users' domain knowledge** — labels and naming must be self-explanatory to a first-time visitor

---

## § 17. Calibration Verification

This document is correctly calibrated if a new AI assistant, after reading it, can answer:

1. ✅ Who is Anthony? (product owner + solo builder, not implementation engineer)
2. ✅ What is TradeOS? (premium portfolio OS, dual currency, Moomoo CSV, Supabase backend)
3. ✅ What does the dashboard look like? (5-tier hierarchy: top bar → ticker → hero → intelligence → positions preview)
4. ✅ How are holdings shown? (decision workspace answering 4 questions per row, not CRUD)
5. ✅ What's the financial semantics rule? ("Holdings Value" not "Total Value" if cash unknown)
6. ✅ What's the FX philosophy? (default 4.00, manual edit, optional live — not hidden auto-magic)
7. ✅ What's the localization rule? (strict single language, no mixing)
8. ✅ What's the design DNA? (Apple-grade liquid glass + restrained palette, NOT v3/v4/generic SaaS)
9. ✅ What's frozen? What's allowed? (backend frozen, frontend allowed — see § 9)
10. ✅ How does Anthony want to communicate? (conclusion first, pushback welcomed, no auto-commits)

**Target calibration accuracy: 95%+**

If your answer to any of the above is uncertain, re-read the relevant section before proceeding.

---

> **Health check**: this document is working if AI diffs are clean (no unnecessary changes), visuals don't drift back to v3/v4 patterns, frozen zones aren't violated, financial labels are honest, and clarifying questions appear *before* implementation begins — not after.
