# TradeOS v5

A premium **portfolio operating system** for individual traders — a decision cockpit, not a generic tracker.

It answers five questions:
1. How is my portfolio doing?
2. What opportunities am I watching?
3. What actions deserve attention?
4. What risks require review?
5. What do I currently own?

> **Status: Phase 2 complete — `v5.0.0` · frozen.** Live at **[tradeos-v5.vercel.app](https://tradeos-v5.vercel.app)**.
> This repo (`ianthony89/TradeOS-v5`) is the Next.js rebuild. The legacy single-file (HTML / Google Apps Script) build lives in a separate repo, [`ianthony89/TradeOS`](https://github.com/ianthony89/TradeOS).

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** — Postgres + Auth + Row Level Security
- **Zustand** — client state (`holdings`, `market`)
- **Tailwind 4** + a custom design-token system in `globals.css`
- **Yahoo Finance** (primary) + **Finnhub** (fallback) quotes, cached via **Upstash Redis**
- CSV import for **Moomoo** broker exports (ZH/EN header auto-detect)

## Surfaces

**Phase 1 — foundation**
- **Auth** — email + numeric PIN (PIN is the Supabase password; bcrypt server-side)
- **Dashboard** — hero holdings value, live market sessions, FX, ticker pulse, allocation donut, risk assessment, top movers
- **Holdings** — decision workspace with a four-lens view switch (Overview · Performance · Allocation · Trading) to focus on one dimension at a time: logo, exposure, P/L hierarchy, strategy/sector taxonomy
- **Watchlist** — radar: symbol / target / distance / status (Watching · Near Target · Triggered)
- **Settings** — theme, language (EN/ZH), currency, manual/live FX

**Phase 2 — intelligence layer (complete & frozen)**
- **Position Hub** (`/holdings/[symbol]`) — per-position decision cockpit: Investment Thesis (10 starter templates), Target Planner (price ladder), Conviction, Review Schedule, Decision Log, and a 5-dimension **Position Quality** grade. Persists via `position_intelligence` + `journal_entries` (migration 007).
- **Dashboard Attention Layer** — a prioritized **Attention Feed** ("what needs my attention today") + **Review Queue**, deep-linking into the Position Hub.
- **Journal** (`/journal`) — a cross-position **Review Workspace**: review pulse, queue, and decision history.
- **Planner** (`/planner`) — a read-only **Portfolio Action Simulator**: Add Capital, Reduce Concentration, Target Allocation (by strategy).

The model: **Dashboard detects → Journal reviews → Position Hub decides → Planner simulates.** `/ai` remains a deferred "coming soon" stub (no AI by product decision).

See **[`ROADMAP.md`](./ROADMAP.md)** for phase status, **[`RELEASES.md`](./RELEASES.md)** for the release log, and **[`docs/PHASE-2-RETROSPECTIVE.md`](./docs/PHASE-2-RETROSPECTIVE.md)** for the Phase 2 retrospective.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Create `.env.local` in the project root (never committed — see `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — server only>
UPSTASH_REDIS_REST_URL=https://<your>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
FINNHUB_API_KEY=<key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Database

Run the migrations in `supabase/migrations/` (root only — `archive/` is superseded) in
ascending order via the Supabase SQL editor. They are idempotent.

---

## Quality gate

```bash
npx tsc --noEmit     # 0 errors
npm run lint         # 0 errors
```

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for the step-by-step Vercel guide.

---

## Project conventions

`AGENTS.md` is the canonical operating contract (product intent, design language,
frozen vs allowed zones, code discipline). Read it before contributing.
