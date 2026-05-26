-- ============================================================
--  TradeOS v5 — Initial Schema
--  Migration 001
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────
-- Extends auth.users (created by Supabase Auth on signup)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Trader',
  -- pin_len stored here for PIN pad UX (how many dots to show).
  -- The PIN itself lives only in Supabase Auth as bcrypt password.
  -- No pin_hash stored here — Supabase handles all hashing.
  pin_len      INT  NOT NULL DEFAULT 6,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'suspended')),
  lang         TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','zh')),
  theme        TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── invite_codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── data_access_permissions ───────────────────────────────────
-- Admin requests to view another user's data (opt-in, default OFF)
CREATE TABLE IF NOT EXISTS data_access_permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  grantee_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  active       BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grantor_id, grantee_id)
);

-- ── import_sessions ───────────────────────────────────────────
-- Each CSV upload creates one session row
CREATE TABLE IF NOT EXISTS import_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  broker           TEXT NOT NULL DEFAULT 'moomoo',
  imported_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  symbol_count     INT,
  total_value_usd  DECIMAL(18,4),
  total_value_myr  DECIMAL(18,4)
);

-- ── holdings ─────────────────────────────────────────────────
-- Current state per user, upserted on each import
CREATE TABLE IF NOT EXISTS holdings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol              TEXT NOT NULL,           -- raw from CSV, e.g. "5555"
  symbol_normalized   TEXT NOT NULL,           -- e.g. "5555.KL"
  name                TEXT,
  quantity            DECIMAL(18,6) NOT NULL,
  available_qty       DECIMAL(18,6),
  avg_cost            DECIMAL(18,6) NOT NULL,
  current_price       DECIMAL(18,6),           -- refreshed by quote engine
  market_value        DECIMAL(18,4),
  unrealized_pl       DECIMAL(18,4),
  unrealized_pl_pct   DECIMAL(8,4),
  realized_pl         DECIMAL(18,4),
  today_pl            DECIMAL(18,4),
  today_turnover      DECIMAL(18,4),
  currency            TEXT NOT NULL DEFAULT 'USD',
  asset_type          TEXT,                    -- US_EQUITY | MY_EQUITY | ETF | INDEX | CRYPTO
  sector              TEXT,
  target_price        DECIMAL(18,6),           -- user-set
  stop_loss           DECIMAL(18,6),           -- user-set
  notes               TEXT,                    -- quick note per holding
  last_import_id      UUID REFERENCES import_sessions(id) ON DELETE SET NULL,
  quotes_updated_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol_normalized)
);

-- ── portfolio_snapshots ───────────────────────────────────────
-- One row per CSV import — powers the historical value line chart
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_usd    DECIMAL(18,4),
  total_myr    DECIMAL(18,4),
  import_id    UUID REFERENCES import_sessions(id) ON DELETE SET NULL
);

-- ── watchlists ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'My Watchlist',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── watchlist_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id      UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_journal_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_holdings_user        ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol      ON holdings(symbol_normalized);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_at    ON portfolio_snapshots(user_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_symbol   ON price_alerts(user_id, symbol_norm);
CREATE INDEX IF NOT EXISTS idx_journal_user         ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_user          ON import_sessions(user_id, imported_at DESC);

-- ============================================================
--  Row Level Security
-- ============================================================

ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries        ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────
CREATE POLICY "profiles: own row only"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── invite_codes ─────────────────────────────────────────────
-- Anyone authenticated can read (to validate code at signup)
CREATE POLICY "invite_codes: read for validation"
  ON invite_codes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "invite_codes: admin can insert"
  ON invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ── data_access_permissions ───────────────────────────────────
CREATE POLICY "permissions: grantor or grantee"
  ON data_access_permissions FOR ALL
  USING (auth.uid() = grantor_id OR auth.uid() = grantee_id);

-- ── import_sessions ───────────────────────────────────────────
CREATE POLICY "import_sessions: own only"
  ON import_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── holdings ─────────────────────────────────────────────────
-- Owner always has full access
CREATE POLICY "holdings: owner full access"
  ON holdings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grantee can SELECT if grantor has active=true permission
CREATE POLICY "holdings: permitted viewer can select"
  ON holdings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM data_access_permissions
      WHERE grantor_id = holdings.user_id
        AND grantee_id = auth.uid()
        AND active = TRUE
    )
  );

-- ── portfolio_snapshots ───────────────────────────────────────
CREATE POLICY "snapshots: own only"
  ON portfolio_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── watchlists ────────────────────────────────────────────────
CREATE POLICY "watchlists: own only"
  ON watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── watchlist_items ───────────────────────────────────────────
CREATE POLICY "watchlist_items: own only"
  ON watchlist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── price_alerts ──────────────────────────────────────────────
CREATE POLICY "price_alerts: own only"
  ON price_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── journal_entries ───────────────────────────────────────────
CREATE POLICY "journal_entries: own only"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
--  Auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, pin_len, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Trader'),
    COALESCE((NEW.raw_user_meta_data->>'pin_len')::int, 6),
    'pending'   -- all new users start pending, admin must approve
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Admin approval: admin can update any profile status ──────
CREATE POLICY "profiles: admin can update status"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (TRUE);

-- ============================================================
--  Public RPC: get_pin_len_by_email
--  Returns pin_len for login PIN pad UX.
--  SECURITY: returns NULL if email not found (no info leak).
--  No password, no hash, no secret exposed.
-- ============================================================
CREATE OR REPLACE FUNCTION get_pin_len_by_email(p_email TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_pin_len INT;
BEGIN
  -- Look up user id from auth.users by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get pin_len from profiles
  SELECT pin_len INTO v_pin_len
  FROM public.profiles
  WHERE id = v_user_id;

  RETURN COALESCE(v_pin_len, 6);
END;
$$;
