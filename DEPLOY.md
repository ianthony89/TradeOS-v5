# Deploying TradeOS v5 to Vercel

TradeOS v5 is a Next.js app with a real backend (API routes + Supabase). It **cannot**
run on GitHub Pages (static only). Use Vercel — built by the Next.js team, free tier is enough.

---

## Step 1 — Import the repo

1. Go to **[vercel.com](https://vercel.com)** → sign in with your **GitHub** account.
2. **Add New… → Project**.
3. Find **`ianthony89/TradeOS`** → **Import**.
4. Vercel auto-detects Next.js. Leave Framework Preset, Build Command, Output as default.
5. **Do not click Deploy yet** — add environment variables first (Step 2).

---

## Step 2 — Environment variables (critical)

In the import screen, expand **Environment Variables** and add all 7.
Copy the values from your local `.env.local`.

| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public — safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** — server only, never exposed |
| `UPSTASH_REDIS_REST_URL` | Quote cache |
| `UPSTASH_REDIS_REST_TOKEN` | **Secret** |
| `FINNHUB_API_KEY` | **Secret** — fallback quotes |
| `NEXT_PUBLIC_SITE_URL` | Set to `https://<your-app>.vercel.app` after first deploy (see Step 4) |

> Without these, login / quotes / CSV import will all fail.

---

## Step 3 — Deploy

Click **Deploy**. First build takes ~1–2 minutes. You'll get a URL like
`https://tradeos-xxxx.vercel.app`.

---

## Step 4 — Fix the site URL

1. Copy the deployed URL.
2. Vercel → Project → **Settings → Environment Variables** → edit
   `NEXT_PUBLIC_SITE_URL` to that URL.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the value takes effect.

This matters for password-reset / email redirect links pointing to the right host.

---

## Step 5 — Supabase auth redirect allowlist

In **Supabase → Authentication → URL Configuration**:
- **Site URL**: your Vercel URL
- **Redirect URLs**: add `https://<your-app>.vercel.app/**`

Otherwise PIN-reset email links will be rejected.

---

## Step 6 — Verify (smoke test)

On the live URL:
- [ ] Login with email + PIN works
- [ ] Dashboard loads holdings + live quotes
- [ ] CSV import works
- [ ] Add a watchlist symbol succeeds (confirms `watchlist_items` table exists)
- [ ] Dark / light toggle persists

---

## Auto-deploy

Once connected, every push to `main` auto-deploys. Preview deploys are created for
other branches. No manual step needed after this setup.

---

## Cleanup — disable the old GitHub Pages site

`main` is now Next.js source (no root `index.html`), so the old
`ianthony89.github.io/TradeOS/` page will 404. Turn it off:

**GitHub → repo Settings → Pages → Source → None.**

The old single-file build is preserved on the `legacy-4.0` branch if you ever need it.
