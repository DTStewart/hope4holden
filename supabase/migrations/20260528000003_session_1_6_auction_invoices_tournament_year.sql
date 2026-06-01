-- Session 1.6 / FILE 3
--
-- Adds a real tournament_year column to auction_invoices and backfills it in
-- the same migration, so there is never a window where the column exists with
-- NULLs for already-paid invoices.
--
-- BACKGROUND
-- ==========
-- Session 2's backfill (supabase/functions/backfill-contacts/index.ts) had no
-- tournament_year source on auction_invoices, so the silent_auction_win walker
-- derived it from EXTRACT(YEAR FROM paid_at) via a deriveYearFromTimestamp
-- helper, flagged as temporary with a comment pointing here. This migration
-- makes the column authoritative; the same commit updates the edge function to
-- read auction_invoices.tournament_year directly and removes the helper.
--
-- The backfill uses the same paid_at-year derivation the edge function used, so
-- the values match what Session 2 already wrote onto contact_activities. The
-- tournament has only run in 2026 to date, so every paid invoice resolves to
-- 2026. Rows with NULL paid_at (unpaid invoices) get NULL tournament_year.

ALTER TABLE public.auction_invoices
  ADD COLUMN IF NOT EXISTS tournament_year INTEGER;

UPDATE public.auction_invoices
   SET tournament_year = EXTRACT(YEAR FROM paid_at)::INTEGER
 WHERE paid_at IS NOT NULL
   AND tournament_year IS NULL;

CREATE INDEX IF NOT EXISTS idx_auction_invoices_tournament_year
  ON public.auction_invoices (tournament_year);

COMMENT ON COLUMN public.auction_invoices.tournament_year IS
  'Tournament year for this auction win. Backfilled in Session 1.6 from EXTRACT(YEAR FROM paid_at); going forward should be set explicitly at invoice creation. Replaced the temporary paid_at derivation in the backfill-contacts edge function.';
