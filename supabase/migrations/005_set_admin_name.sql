-- ============================================================
--  TradeOS v5 — Patch 005
--  Sets the admin account's display name.
--  Migration 003's admin approval block only set status + is_admin,
--  leaving name as the default 'Trader' — which is what shows in
--  the topbar greeting.
-- ============================================================

UPDATE public.profiles
  SET name = 'Anthony'
  WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'anthony.cody89@gmail.com'
  );
