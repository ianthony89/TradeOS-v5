-- ============================================================
--  TradeOS v5 — Patch Migration 002
--  Safe to run even if 001 was partially applied.
--  Handles: Supabase pre-created profiles table (missing columns),
--  plus all tables that depend on 001 being complete.
-- ============================================================

-- ── pgcrypto (idempotent) ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Patch profiles: add any columns that 001 may have skipped ─
-- (Safe: ADD COLUMN IF NOT EXISTS is idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name         TEXT        NOT NULL DEFAULT 'Trader',
  ADD COLUMN IF NOT EXISTS pin_len      INT         NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS status       TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS lang         TEXT        NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme        TEXT        NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS is_admin     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add CHECK constraints if they don't already exist (skip if duplicate)
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_status_check
    CHECK (status IN ('pending','approved','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_lang_check
    CHECK (lang IN ('en','zh'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_theme_check
    CHECK (theme IN ('dark','light'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── invite_codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── data_access_permissions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS data_access_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  grantee_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grantor_id, grantee_id)
);

-- ── import_sessions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker           TEXT NOT NULL DEFAULT 'moomoo',
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol_count     INT,
  total_value_usd  DECIMAL(18,4),
  total_value_myr  DECIMAL(18,4)
);

-- ── holdings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS holdings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol              TEXT NOT NULL,
  symbol_normalized   TEXT NOT NULL,
  name                TEXT,
  quantity            DECIMAL(18,6) NOT NULL,
  available_qty       DECIMAL(18,6),
  avg_cost            DECIMAL(18,6) NOT NULL,
  current_price       DECIMAL(18,6),
  market_value        DECIMAL(18,4),
  unrealized_pl       DECIMAL(18,4),
  unrealized_pl_pct   DECIMAL(8,4),
  realized_pl         DECIMAL(18,4),
  today_pl            DECIMAL(18,4),
  today_turnover      DECIMAL(18,4),
  currency            TEXT NOT NULL DEFAULT 'USD',
  asset_type          TEXT,
  sector              TEXT,
  target_price        DECIMAL(18,6),
  stop_loss           DECIMAL(18,6),
  notes               TEXT,
  last_import_id      UUID REFERENCES import_sessions(id) ON DELETE SET NULL,
  quotes_updated_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol_normalized)
);

-- ── portfolio_snapshots ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_usd    DECIMAL(18,4),
  total_myr    DECIMAL(18,4),
  import_id    UUID REFERENCES import_sessions(id) ON DELETE SET NULL
);

-- ── watchlists ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'My Watchlist',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── watchlist_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id      UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  symbol_normalized TEXT NOT NULL,
  name              TEXT,
  alert_price       DECIMAL(18,6),
  alert_direction   TEXT CHECK (alert_direction IN ('above','below')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (watchlist_id, symbol_normalized)
);

-- ── price_alerts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  symbol_norm  TEXT NOT NULL,
  condition    TEXT NOT NULL CHECK (condition IN ('above','below')),
  price        DECIMAL(18,6) NOT NULL,
  triggered    BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── journal_entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol       TEXT,
  title        TEXT,
  content      TEXT,
  entry_type   TEXT NOT NULL DEFAULT 'manual'
                 CHECK (entry_type IN ('manual','auto_new_holding','auto_price_move')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop and recreate triggers (idempotent)
DROP TRIGGER IF EXISTS trg_profiles_updated_at  ON public.profiles;
DROP TRIGGER IF EXISTS trg_holdings_updated_at  ON holdings;
DROP TRIGGER IF EXISTS trg_journal_updated_at   ON journal_entries;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_journal_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_holdings_user      ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol    ON holdings(symbol_normalized);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_at  ON portfolio_snapshots(user_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_symbol ON price_alerts(user_id, symbol_norm);
CREATE INDEX IF NOT EXISTS idx_journal_user       ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_user        ON import_sessions(user_id, imported_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_permissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries             ENABLE ROW LEVEL SECURITY;

-- Drop old policies then recreate (idempotent)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles','invite_codes','data_access_permissions',
        'import_sessions','holdings','portfolio_snapshots',
        'watchlists','watchlist_items','price_alerts','journal_entries'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- profiles
CREATE POLICY "profiles: own row"
  ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: admin update status"
  ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (TRUE);

-- invite_codes
CREATE POLICY "invite_codes: read"
  ON invite_codes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "invite_codes: admin insert"
  ON invite_codes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- data_access_permissions
CREATE POLICY "permissions: grantor or grantee"
  ON data_access_permissions FOR ALL
  USING (auth.uid() = grantor_id OR auth.uid() = grantee_id);

-- import_sessions
CREATE POLICY "import_sessions: own only"
  ON import_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- holdings
CREATE POLICY "holdings: owner full access"
  ON holdings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "holdings: permitted viewer select"
  ON holdings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM data_access_permissions
    WHERE grantor_id = holdings.user_id
      AND grantee_id = auth.uid()
      AND active = TRUE
  ));

-- portfolio_snapshots
CREATE POLICY "snapshots: own only"
  ON portfolio_snapshots FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- watchlists
CREATE POLICY "watchlists: own only"
  ON watchlists FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- watchlist_items
CREATE POLICY "watchlist_items: own only"
  ON watchlist_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- price_alerts
CREATE POLICY "price_alerts: own only"
  ON price_alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- journal_entries
CREATE POLICY "journal_entries: own only"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Auto-create profile on signup ─────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, pin_len, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Trader'),
    COALESCE((NEW.raw_user_meta_data->>'pin_len')::int, 6),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;  -- safe if profile row already exists
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── get_pin_len_by_email RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION get_pin_len_by_email(p_email TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_pin_len  INT;
BEGIN
  SELECT id INTO v_user_id FROM auth.users
  WHERE LOWER(email) = LOWER(p_email) LIMIT 1;
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT pin_len INTO v_pin_len FROM public.profiles WHERE id = v_user_id;
  RETURN COALESCE(v_pin_len, 6);
END;
$$;

-- ── Approve your admin account ────────────────────────────────
-- This sets the currently-existing user as admin + approved.
-- Replace the UUID below with your actual user UUID if different.
UPDATE public.profiles
  SET status   = 'approved',
      is_admin = TRUE,
      name     = COALESCE(NULLIF(name, ''), NULLIF(name, 'Trader'), 'Admin')
  WHERE id IN (
    SELECT id FROM auth.users
    WHERE email = 'anthony.cody89@gmail.com'
  );
