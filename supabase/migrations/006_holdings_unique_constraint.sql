-- ============================================================
--  TradeOS v5 — Patch 006
--  Adds the UNIQUE (user_id, symbol_normalized) constraint that
--  the import route's `ON CONFLICT user_id,symbol_normalized`
--  upsert requires. PostgreSQL error 42P10.
--
--  Root cause:
--    The holdings table was created by an earlier partial migration
--    WITHOUT the UNIQUE constraint clause. Subsequent
--    `CREATE TABLE IF NOT EXISTS` was a no-op (table already exists),
--    and `ALTER TABLE ADD COLUMN IF NOT EXISTS` patches add columns
--    but never constraints. So the constraint never materialized.
--
--  This migration:
--    1. Safely deduplicates any pre-existing duplicate rows
--       (keeps the most recent per user_id+symbol_normalized).
--    2. Adds the UNIQUE constraint.
--  Idempotent — safe to run multiple times.
-- ============================================================

-- Step 1: Dedupe.  Keep most recent row per (user_id, symbol_normalized).
--   Tiebreaker: updated_at DESC > created_at DESC > id DESC.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, symbol_normalized
           ORDER BY updated_at DESC NULLS LAST,
                    created_at DESC NULLS LAST,
                    id         DESC
         ) AS rn
  FROM holdings
)
DELETE FROM holdings
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: Add UNIQUE constraint (catches duplicate_object if already there).
DO $$
BEGIN
  ALTER TABLE holdings
    ADD CONSTRAINT holdings_user_symbol_unique
    UNIQUE (user_id, symbol_normalized);
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already exists, ignore
  WHEN duplicate_table  THEN NULL;
END $$;
