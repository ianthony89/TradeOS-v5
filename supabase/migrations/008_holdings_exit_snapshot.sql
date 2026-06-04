-- ============================================================
--  TradeOS v5 — Migration 008: Holdings exit snapshot (v5.0.5)
--  Idempotent — safe to run repeatedly.
--
--  Adds two columns to `holdings`, frozen by the close-in-place import
--  the moment a position leaves the CSV:
--    exit_price  — the last known price at exit (proxy for the sale price;
--                  Moomoo CSV does not carry the fill price)
--    exit_date   — when the position was closed
--
--  Why a column and not `current_price`: `current_price` is rewritten by the
--  quote engine on every Dashboard / Journal / Planner / Position-Hub visit,
--  so it can't hold a stable exit price. These columns are write-once at the
--  open→closed transition and never touched by the quote engine — which makes
--  the Holdings "Since Exit %" metric correct and permanent.
--
--  Columns inherit the existing holdings RLS (owner-only); no new policies.
-- ============================================================

ALTER TABLE holdings
  ADD COLUMN IF NOT EXISTS exit_price DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS exit_date  TIMESTAMPTZ;
