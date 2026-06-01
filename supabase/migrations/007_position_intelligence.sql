-- ============================================================
--  TradeOS v5 — Migration 007: Position Intelligence (Phase 2A)
--  Idempotent — safe to run repeatedly.
--
--  Adds:   position_intelligence — 1 row per (user, symbol):
--          Investment Thesis + Target Planner fields.
--  Reuses: journal_entries (created in 003) as the per-position Review Log.
--          Re-created here IF NOT EXISTS in case 003 was only partially
--          applied (see the legacy-DB gotcha in AGENTS.md § 15).
--
--  Data is keyed by (user_id, symbol_normalized) so a thesis survives a
--  CSV re-import or a full position exit — and so a future cross-position
--  aggregated Journal/Planner page can read the same rows without a symbol
--  filter.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- set_updated_at() is defined in 003; redefine defensively so this file is
-- self-contained even on a DB where 003 never ran.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ── position_intelligence (Thesis + Targets, merged 1:1) ──────
CREATE TABLE IF NOT EXISTS position_intelligence (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  symbol_normalized TEXT NOT NULL,
  -- Investment thesis
  thesis            TEXT,
  bull_case         TEXT,
  bear_case         TEXT,
  invalidation      TEXT,
  -- Target planner
  target_price      DECIMAL(18,6),
  trim_above        DECIMAL(18,6),
  add_below         DECIMAL(18,6),
  fair_value        DECIMAL(18,6),
  target_currency   TEXT NOT NULL DEFAULT 'USD',
  plan_notes        TEXT,
  -- Conviction + review scheduling (Phase 2A foundation). The future Alert
  -- Engine reads next_review_at to flag "Review Due / Overdue". No
  -- notifications wired now — columns only.
  confidence            TEXT,          -- 'high' | 'medium' | 'low' | null
  review_frequency_days INT,           -- 30 / 60 / 90 / 180, null = off
  next_review_at        TIMESTAMPTZ,
  -- Per-section edit timestamps (drive the "Updated X ago" line + the
  -- synthesized Decision Log milestones). Distinct from the row-level
  -- updated_at trigger.
  thesis_updated_at  TIMESTAMPTZ,
  targets_updated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol_normalized)
);
-- (idempotent re-add for a DB where the table pre-existed without them)
ALTER TABLE position_intelligence
  ADD COLUMN IF NOT EXISTS thesis_updated_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS targets_updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confidence            TEXT,
  ADD COLUMN IF NOT EXISTS review_frequency_days INT,
  ADD COLUMN IF NOT EXISTS next_review_at        TIMESTAMPTZ;

-- ── journal_entries (Review Log) — ensure it exists ──────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  symbol     TEXT,
  title      TEXT,
  content    TEXT,
  entry_type TEXT NOT NULL DEFAULT 'manual'
               CHECK (entry_type IN ('manual','auto_new_holding','auto_price_move')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision Log is a decision history, not just reviews. Widen entry_type so
-- future automation can append typed portfolio events (opened / added /
-- reduced / exited / thesis_updated / target_updated). Phase 2A only writes
-- 'manual'; the rest are reserved. (Not implemented now — schema only.)
DO $$ BEGIN
  ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_entry_type_check
    CHECK (entry_type IN (
      'manual',
      'opened','added','reduced','exited',
      'thesis_updated','target_updated','review',
      'auto_new_holding','auto_price_move'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Indexes ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_posintel_user_symbol
    ON position_intelligence(user_id, symbol_normalized);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_journal_user_symbol
    ON journal_entries(user_id, symbol, created_at DESC);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ── RLS — owner-only (matches every other user table) ────────
ALTER TABLE position_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('position_intelligence','journal_entries')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "position_intelligence: own only"
  ON position_intelligence FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_entries: own only"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── updated_at triggers ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_posintel_updated_at ON position_intelligence;
CREATE TRIGGER trg_posintel_updated_at
  BEFORE UPDATE ON position_intelligence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_journal_updated_at ON journal_entries;
CREATE TRIGGER trg_journal_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
