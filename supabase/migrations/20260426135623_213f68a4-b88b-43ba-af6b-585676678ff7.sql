-- Session 1.5 / FILE 8 (data backfill)
-- Backfill tax_receipt_eligible = true for activity types that, by policy,
-- always qualify for an ATCP tax receipt:
--   - donation:           straight donation, fully receiptable
--   - auction_win:        legacy single auction-win type from Session 1
--   - silent_auction_win: Session 1.5 silent-auction win
-- Idempotent: WHERE clause excludes rows already flagged.
UPDATE public.contact_activities
SET tax_receipt_eligible = true
WHERE activity_type IN ('donation', 'auction_win', 'silent_auction_win')
  AND tax_receipt_eligible = false;