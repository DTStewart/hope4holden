-- Session 1.5 / FILE 3
--
-- auction_items: add three columns for Session 1.5 financial work:
--   - donated_item_id: link back to the in-kind donor when the item came from a donation
--   - retail_value_cents: FMV displayed at auction (cents) — drives tax-receipt math
--   - cost_to_event_cents: what the event paid for the item (null when donated)
--
-- DRIFT NOTE — units mismatch:
-- The existing market_value column is INTEGER DOLLARS, matching the project-wide
-- "dollars-as-integer" convention. Session 1.5 RPCs (get_financial_summary,
-- get_live_display_state) standardize on cents. We add retail_value_cents as
-- a new column (BIGINT cents) and backfill from market_value * 100. The legacy
-- market_value column is LEFT IN PLACE for backwards compatibility with
-- existing frontend code (Auction.tsx, AuctionTab.tsx). A future PR can
-- deprecate it once the auction UI moves to the cents convention.

ALTER TABLE public.auction_items
  ADD COLUMN IF NOT EXISTS donated_item_id UUID
    REFERENCES public.donated_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retail_value_cents BIGINT,
  ADD COLUMN IF NOT EXISTS cost_to_event_cents BIGINT;

-- Backfill retail_value_cents from existing market_value (dollars → cents).
-- Idempotent: only fills NULLs so re-running won't double-multiply.
UPDATE public.auction_items
SET retail_value_cents = market_value * 100
WHERE retail_value_cents IS NULL;

COMMENT ON COLUMN public.auction_items.donated_item_id IS
  'Link to the in-kind donated_items row if this auction item came from an in-kind donation. Null for items the event purchased.';
COMMENT ON COLUMN public.auction_items.retail_value_cents IS
  'FMV displayed at auction in cents. Drives tax-receipt math (winning_amount - retail_value = receipt-eligible). Backfilled from market_value * 100; market_value remains in dollars for backwards compat.';
COMMENT ON COLUMN public.auction_items.cost_to_event_cents IS
  'What the event paid for the item if purchased rather than donated. Null when the item was donated.';


-- Backfill the donated_items.auction_item_id FK now that the column exists on
-- the referenced table (target column is auction_items.id, not the new one,
-- but the conceptual dependency is "donated_items needs auction_items to exist
-- before adding the FK" — both did, so this is purely sequencing for clarity).
ALTER TABLE public.donated_items
  ADD CONSTRAINT fk_donated_items_auction_item
  FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(id) ON DELETE SET NULL;
