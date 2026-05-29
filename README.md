# TradeOS v5

A premium **portfolio operating system** for individual traders — a decision cockpit, not a generic tracker.

It answers five questions:
1. How is my portfolio doing?
2. What opportunities am I watching?
3. What actions deserve attention?
4. What risks require review?
5. What do I currently own?

> The legacy single-file (HTML / Google Apps Script) build lives on the [`legacy-4.0`](../../tree/legacy-4.0) branch. `main` is the Next.js rebuild.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** — Postgres + Auth + Row Level Security
- **Zustand** — client state (`holdings`, `market`)
- **Tailwind 4** + a custom design-token system in `globals.css`
- **Yahoo Finance** (primary) + **Finnhub** (fallback) quotes, cached via **Upstash Redis**
- CSV import for **Moomoo** broker exports (ZH/EN header auto-detect)

## Core surfaces (Phase 1 — complete)

- **Auth** — email + numeric PIN (PIN is the Supabase password; bcrypt server-side)
- **Dashboard** — hero holdings value, live market sessions, FX, ticker pulse, Action Center, allocation donut, top movers
- **Holdings** — decision workspace: logo, exposure, P/L hierarchy, strategy/action taxonomy
- **Watchlist** — radar: symbol / target / distance / status (Watching · Near Target · Triggered)
- **Settings** — theme, language, currency, manual/live FX

Journal / Planner / AI are honest "coming soon" roadmap cards (Phase 2).

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
