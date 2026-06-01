-- Session 1.6 / FILE 1
--
-- Creates the outbound_links table and adds six link-tracking columns to
-- contact_activities. Together these implement the link-attribution layer that
-- was originally scoped for Session 1.5 but deferred until after Session 2's
-- backfill landed.
--
-- PAYMENT_METHOD vs PAYMENT_PROCESSOR
-- ===================================
-- Session 1.5 shipped `payment_processor` on contact_activities. It answers
-- "which third-party processor handled the money" (stripe / square / manual /
-- cash / ...) and drives the `revenue_by_processor` aggregation in the
-- `get_financial_summary` RPC. We are intentionally NOT modifying it here.
--
-- This file adds a *separate* `payment_method` column. It answers a different
-- question: "how did the funds arrive at the event" (stripe / cash / cheque /
-- eft / in_kind / other). It is the reconciliation enum from the Rev 2 spec.
-- Earlier Rev 3 wording in h4h-crm-handover.md called this a rename of
-- payment_processor — that was wrong. They are distinct columns serving
-- distinct reporting needs and both stay on the table.
--
-- `payment_method` is nullable so the 137 rows Session 2 already backfilled
-- (all payment_processor='stripe') stay valid. A future session can backfill
-- payment_method='stripe' onto those rows if/when needed.
--
-- All other added columns are nullable except `entered_manually`, which is
-- NOT NULL DEFAULT false so backfilled rows are correctly tagged as not
-- manually entered without requiring an UPDATE pass.

-- ============================================================================
-- 1. outbound_links table
-- ============================================================================
CREATE TABLE public.outbound_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,

  -- Who I sent it to (placeholder, may differ from who actually pays)
  sent_to_name TEXT NOT NULL,
  sent_to_email TEXT,
  sent_to_phone TEXT,
  sent_to_contact_id UUID REFERENCES public.contacts(id),
  -- Optional: if I send to a known existing contact, link it. If unknown,
  -- just store the name.

  -- What the link is for
  link_type TEXT NOT NULL CHECK (link_type IN (
    'registration',
    'sponsorship',
    'dinner',
    'donation',
    'generic_checkout'
  )),

  intended_amount_cents BIGINT,
  intended_tier_id UUID REFERENCES public.sponsorship_tiers(id),
  -- Set when link_type='sponsorship' and a specific tier was pre-selected.
  notes TEXT,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent',
    'opened',
    'redeemed',
    'expired',
    'voided'
  )),

  redeemed_at TIMESTAMPTZ,
  redeemed_by_contact_id UUID REFERENCES public.contacts(id),
  redeemed_activity_id UUID REFERENCES public.contact_activities(id),
  void_reason TEXT,

  tournament_year INTEGER,
  event_type TEXT DEFAULT 'h4h_golf',

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbound_links_token ON public.outbound_links (token);
CREATE INDEX idx_outbound_links_status ON public.outbound_links (status, tournament_year);
CREATE INDEX idx_outbound_links_sent_to ON public.outbound_links (sent_to_contact_id);

COMMENT ON TABLE public.outbound_links IS
  'Tokenized one-time payment/registration links sent to known or prospective contacts. Single-use, locked after redemption at the application layer (admin can still void). Generalizes the legacy sponsor_invites flow.';

COMMENT ON COLUMN public.outbound_links.sent_to_name IS
  'Free-text recipient name as it appeared at send time. Preserved even if no matching contact row exists, so attribution survives the recipient never registering.';
COMMENT ON COLUMN public.outbound_links.sent_to_contact_id IS
  'Optional FK to the recipient contact, when one already existed at send time. Distinct from redeemed_by_contact_id (the entity that actually paid).';
COMMENT ON COLUMN public.outbound_links.redeemed_by_contact_id IS
  'The contact that actually paid. May differ from sent_to_contact_id when Bob sent the link but ACME paid.';
COMMENT ON COLUMN public.outbound_links.status IS
  'Lifecycle state. Single-use enforcement (no re-redeem) lives in the redeem_outbound_link RPC, not as a DB constraint, so admins can void+reissue if needed.';

ALTER TABLE public.outbound_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='outbound_links'
       AND policyname='Admins can manage outbound links'
  ) THEN
    CREATE POLICY "Admins can manage outbound links" ON public.outbound_links
      FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;


-- ============================================================================
-- 2. contact_activities: six new columns
-- ============================================================================
-- Additive only. No existing column types or constraints are altered, so the
-- 137 rows backfilled by Session 2 remain valid as-is.
ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS outbound_link_id UUID REFERENCES public.outbound_links(id),
  ADD COLUMN IF NOT EXISTS sent_to_contact_id UUID REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS entered_manually BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entered_by UUID REFERENCES auth.users(id);

-- payment_method CHECK is added separately so the column can stay nullable and
-- existing rows (where payment_method IS NULL) satisfy the constraint.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.contact_activities'::regclass
       AND conname = 'contact_activities_payment_method_check'
  ) THEN
    ALTER TABLE public.contact_activities
      ADD CONSTRAINT contact_activities_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN (
        'stripe',
        'cash',
        'cheque',
        'eft',
        'in_kind',
        'other'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contact_activities_outbound_link
  ON public.contact_activities (outbound_link_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_sent_to
  ON public.contact_activities (sent_to_contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_activities_entered_by
  ON public.contact_activities (entered_by);

COMMENT ON COLUMN public.contact_activities.outbound_link_id IS
  'FK to the outbound_links row this activity redeemed, if any. NULL for organic transactions that came in without a tokenized link.';
COMMENT ON COLUMN public.contact_activities.sent_to_contact_id IS
  'When a paid link was originally sent to someone OTHER than the contact who ended up paying, points to the recipient. contact_id remains the payer. Drives "Bob sent it, ACME paid" attribution.';
COMMENT ON COLUMN public.contact_activities.payment_method IS
  'How the funds arrived (stripe | cash | cheque | eft | in_kind | other). Distinct from payment_processor (which is "which third-party processor handled it"). Nullable. Reconciliation column for cash/cheque/EFT events.';
COMMENT ON COLUMN public.contact_activities.payment_reference IS
  'Free-text reference for offline payments: cheque number, EFT confirmation code, in-kind appraisal note, etc.';
COMMENT ON COLUMN public.contact_activities.entered_manually IS
  'True when the activity was entered through the admin Manual Entry dialog rather than landing via Stripe webhook or backfill. NOT NULL DEFAULT false so backfilled rows are correctly tagged false.';
COMMENT ON COLUMN public.contact_activities.entered_by IS
  'FK to the admin auth.users row that entered the activity manually. NULL for non-manual rows.';
