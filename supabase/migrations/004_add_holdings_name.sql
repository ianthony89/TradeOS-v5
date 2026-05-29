-- ============================================================
--  TradeOS v5 — Patch 004
--  Adds missing `name` column to holdings.
--  Root cause: migration 003's ALTER TABLE holdings patch list
--  omitted `name`, so pre-existing tables didn't get it.
--  CREATE TABLE IF NOT EXISTS included it, but pre-existing
--  tables were skipped by that branch.
-- ============================================================

ALTER TABLE holdings ADD COLUMN IF NOT EXISTS name TEXT;
