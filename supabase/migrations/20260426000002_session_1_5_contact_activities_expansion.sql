-- Session 1.5 / FILE 1
--
-- contact_activities: expand the activity_type CHECK constraint with five new
-- values, and add columns for processor fees, payment processor identification,
-- cost-of-goods, tax-receipt eligibility, donor receipt opt-in, and donated-item
-- linkage.
--
-- The donated_item_id FK is added in FILE 2 (donated_items table doesn't exist yet).
--
-- ACTIVITY_TYPE NOTE: Session 1 shipped 10 values. We add 5 new ones:
--   merchandise_sale, event_addon, silent_auction_win, rainbow_auction_ticket,
--   mulligan. Final count: 15. We do NOT add live_auction_win — project is
--   silent-auction only.

-- 1. Expand activity_type CHECK
ALTER TABLE public.contact_activities
  DROP CONSTRAINT contact_activities_activity_type_check;

ALTER TABLE public.contact_activities
  ADD CONSTRAINT contact_activities_activity_type_check CHECK (activity_type IN (
    -- Session 1 values (preserved)
    'team_registration',
    'extra_golfer',
    'donation',
    'sponsorship',
    'dinner_ticket',
    'auction_bid',
    'auction_win',
    'manual_note',
    'consent_given',
    'consent_revoked',
    -- Session 1.5 additions
    'merchandise_sale',
    'event_addon',
    'silent_auction_win',
    'rainbow_auction_ticket',
    'mulligan'
  ));


-- 2. New columns
ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS processor_fee_cents BIGINT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT,
  ADD COLUMN IF NOT EXISTS cost_of_goods_cents BIGINT,
  ADD COLUMN IF NOT EXISTS tax_receipt_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS donated_item_id UUID;
  -- FK constraint on donated_item_id added in FILE 2.

COMMENT ON COLUMN public.contact_activities.processor_fee_cents IS
  'Payment-processor fee for this activity. Stripe: charge.balance_transaction.fee. Square: payment.processing_fee_money.amount. Null when unknown or N/A (e.g. cash, manual).';
COMMENT ON COLUMN public.contact_activities.payment_processor IS
  'Which processor handled the payment (''stripe'', ''square'', ''manual'', ''cash'', etc.). Drives the revenue_by_processor breakdown in get_financial_summary.';
COMMENT ON COLUMN public.contact_activities.cost_of_goods_cents IS
  'What the event paid for the item being sold (e.g. merch wholesale price). Subtracted from gross revenue to compute net.';
COMMENT ON COLUMN public.contact_activities.tax_receipt_eligible IS
  'Whether this activity qualifies for a tax receipt (donations, the above-FMV portion of an auction win, etc.). Drives tax_receiptable_cents in get_financial_summary.';
COMMENT ON COLUMN public.contact_activities.receipt_requested IS
  'Donor opted in to wanting a tax receipt. ATCP issues the receipts directly; we do not track issuance.';
COMMENT ON COLUMN public.contact_activities.donated_item_id IS
  'For silent_auction_win and rainbow_auction_ticket activities, links to the in-kind donated item if applicable. FK added in FILE 2.';
