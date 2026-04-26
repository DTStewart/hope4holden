-- Session 1.5 / FILE 4
--
-- Rainbow auction: split the prize catalog from the winner records.
--
-- The existing rainbow_auction_winners table combines prize description with
-- winner name. This migration introduces a separate prizes table and ALTERs
-- the existing winners table to reference it via prize_id, plus add winner
-- contact linkage, year scoping, and a cents-denominated winning_amount.
--
-- DRIFT NOTE — units & legacy columns:
-- The existing rainbow_auction_winners.amount column is INTEGER DOLLARS.
-- We add winning_amount_cents (BIGINT) and backfill from amount * 100.
-- The legacy columns (prize_description, winner_name, amount) are LEFT IN
-- PLACE for backwards compatibility with the live dashboard which currently
-- reads the combined shape. Future PRs can deprecate them once the UI
-- moves to the normalized form.
--
-- tournament_year is added as nullable; backfilling existing rows requires
-- a manual decision (most pre-2027 rows can be assumed 2026, but I'm not
-- doing that automatically).

-- 1. New prizes table
CREATE TABLE public.rainbow_auction_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_name TEXT NOT NULL,
  prize_description TEXT,
  retail_value_cents BIGINT,
  donated_item_id UUID REFERENCES public.donated_items(id) ON DELETE SET NULL,
  tournament_year INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_displayed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rainbow_auction_prizes_year ON public.rainbow_auction_prizes(tournament_year);
CREATE INDEX idx_rainbow_auction_prizes_displayed ON public.rainbow_auction_prizes(is_displayed, sort_order);

ALTER TABLE public.rainbow_auction_prizes ENABLE ROW LEVEL SECURITY;

-- Admin only direct access. The live-display RPC (FILE 7) is SECURITY DEFINER
-- and reads through this restriction for anon callers.
CREATE POLICY "Admins can manage rainbow auction prizes"
  ON public.rainbow_auction_prizes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rainbow_auction_prizes_updated_at
  BEFORE UPDATE ON public.rainbow_auction_prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Extend existing rainbow_auction_winners
-- (preserve existing RLS and legacy columns; only ADD)
ALTER TABLE public.rainbow_auction_winners
  ADD COLUMN IF NOT EXISTS prize_id UUID
    REFERENCES public.rainbow_auction_prizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS tournament_year INTEGER;

-- Backfill winning_amount_cents from existing amount (dollars → cents).
-- Idempotent: only fills NULLs.
UPDATE public.rainbow_auction_winners
SET winning_amount_cents = amount * 100
WHERE amount IS NOT NULL AND winning_amount_cents IS NULL;

COMMENT ON COLUMN public.rainbow_auction_winners.prize_id IS
  'Normalized link to rainbow_auction_prizes. Replaces the legacy prize_description column for new rows.';
COMMENT ON COLUMN public.rainbow_auction_winners.winner_contact_id IS
  'Normalized link to contacts. Replaces the legacy winner_name column for new rows.';
COMMENT ON COLUMN public.rainbow_auction_winners.winning_amount_cents IS
  'Winning bid in cents. Backfilled from amount * 100; the legacy amount column (dollars) remains for backwards compat.';
COMMENT ON COLUMN public.rainbow_auction_winners.tournament_year IS
  'Year scoping. Pre-existing rows are NOT backfilled — set to 2026 manually if needed.';


-- 3. Backfill the donated_items.rainbow_prize_id FK now that rainbow_auction_prizes exists.
ALTER TABLE public.donated_items
  ADD CONSTRAINT fk_donated_items_rainbow_prize
  FOREIGN KEY (rainbow_prize_id) REFERENCES public.rainbow_auction_prizes(id) ON DELETE SET NULL;
