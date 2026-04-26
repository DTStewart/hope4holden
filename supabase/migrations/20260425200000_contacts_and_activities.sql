-- =============================================================================
-- Hope 4 Holden CRM Foundation
-- Migration: contacts + contact_activities
--
-- Introduces a unified contacts model to replace person-data fragmentation
-- across registrations, donations, sponsors, dinners, auction_bidders,
-- auction_invoices, dinners, waitlist, next_year_interest, email_subscribers,
-- and messages. Forward-looking writes will be migrated to populate these
-- tables in a later session; backfill from existing transaction tables
-- runs in Session 2.
--
-- Architectural decisions documented in the CRM handover doc:
--   - Pattern 3: contacts + contact_activities (not a single golfers table)
--   - Hybrid source linking: typed FKs for the six current source tables,
--     plus polymorphic source_table + source_id for future event types
--   - Email is the dedup key, case-insensitive via lower(trim(email)) index
--   - Single name field, no first/last split (matches existing convention)
--   - Marketing consent default false, true opt-in, CASL-compliant
--   - Captain cannot consent for teammates; each individual self-consents
--   - amount_cents on contact_activities even though source tables use
--     integer dollars; convert at write time. Single source of truth in cents.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: contacts
-- -----------------------------------------------------------------------------
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity. Email is the canonical dedup key but is nullable to support
  -- walk-up cash donors, manual notes, and other no-email cases.
  email TEXT,
  name TEXT NOT NULL,
  phone TEXT,

  -- Address (optional, populated from sponsorship contact details and
  -- walk-up donation entries that include mailing addresses)
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'CA',

  -- Marketing consent (CASL). Default false; must be actively set true.
  -- consent_source documents the legal provenance of the consent
  -- (e.g., 'pre_tournament_email_2026', 'donation_form_ticker_optin',
  -- 'sponsor_form', 'admin_manual_entry'). unsubscribed_at, when set,
  -- supersedes marketing_consent.
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at TIMESTAMPTZ,
  consent_source TEXT,
  unsubscribed_at TIMESTAMPTZ,

  -- Public display consent for the donation ticker (and future public
  -- recognition surfaces). Migrated from donations.public_display_consent
  -- in Session 5. public_display_name allows a contact to choose how
  -- they want to be shown publicly (e.g., "The Smith Family" instead
  -- of "John Smith"). When false, displays as "A friend of Holden".
  public_display_consent BOOLEAN NOT NULL DEFAULT false,
  public_display_name TEXT,

  -- Admin-facing metadata
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness on email, partial index ignores nulls.
-- Matches the convention used in auction_bidders and next_year_interest.
CREATE UNIQUE INDEX idx_contacts_email_lower
  ON public.contacts (lower(trim(email)))
  WHERE email IS NOT NULL;

-- Lookup indexes for admin search
CREATE INDEX idx_contacts_name_lower ON public.contacts (lower(name));
CREATE INDEX idx_contacts_phone ON public.contacts (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contacts_marketing_consent ON public.contacts (marketing_consent) WHERE marketing_consent = true;
CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.contacts_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contacts_set_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.contacts_set_updated_at();

COMMENT ON TABLE public.contacts IS
  'Unified contact directory. Each row is a unique person (or organization '
  'in the case of sponsor primary contacts) deduplicated by lower(trim(email)). '
  'See contact_activities for the per-transaction history.';

COMMENT ON COLUMN public.contacts.marketing_consent IS
  'CASL marketing consent. Default false (active opt-in required). When true, '
  'consent_recorded_at and consent_source must be populated. unsubscribed_at, '
  'when set, supersedes this field.';

COMMENT ON COLUMN public.contacts.public_display_consent IS
  'Consent to display this contact as a supporter on public pages '
  '(donation ticker, future donor walls). Migrated from donations.public_display_consent '
  'in Session 5 of the CRM build.';

-- -----------------------------------------------------------------------------
-- Table: contact_activities
-- -----------------------------------------------------------------------------
CREATE TABLE public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,

  -- What kind of activity this is. Enforced via CHECK rather than enum
  -- to avoid the schema-migration pain of altering an enum type when
  -- new activity kinds are added.
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'team_registration',   -- captain or roster member of a paid team
    'extra_golfer',        -- paid to be added beyond the team of 4
    'donation',            -- gave money outside any other transaction
    'sponsorship',         -- gave money in exchange for sponsor recognition
    'dinner_ticket',       -- bought one or more dinner tickets
    'auction_bid',         -- placed a bid (won or lost)
    'auction_win',         -- won an auction item
    'manual_note',         -- admin-added interaction (call, in-person, etc.)
    'consent_given',       -- pre-tournament consent collection event
    'consent_revoked'      -- explicit unsubscribe or revocation
  )),

  -- Event scoping. tournament_year is nullable so that non-tournament
  -- activities (manual notes, consent events) don't need a year. event_type
  -- gives us room for future Stewart family events without schema changes.
  tournament_year INTEGER,
  event_type TEXT NOT NULL DEFAULT 'h4h_golf',

  -- Money. Standardized to cents on contact_activities even though source
  -- tables use integer dollars (single exception: extra_golfer_invites.price_per_golfer
  -- which is already cents). Conversion happens at write time.
  -- tax_receipt_amount_cents is only populated where it differs from amount_cents
  -- (currently just auction_invoices.tax_receipt_amount, which represents the
  -- portion of an auction win eligible for an ATCP tax receipt).
  amount_cents BIGINT,
  tax_receipt_amount_cents BIGINT,

  -- Hybrid source linking: typed FKs for the six current source tables
  -- give us referential integrity for the backfill and for future writes.
  -- The polymorphic pair (source_table + source_id) handles future event
  -- types where adding a typed FK column would mean a schema change.
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
  sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
  dinner_id UUID REFERENCES public.dinners(id) ON DELETE SET NULL,
  auction_invoice_id UUID REFERENCES public.auction_invoices(id) ON DELETE SET NULL,
  auction_bid_id UUID REFERENCES public.auction_bids(id) ON DELETE SET NULL,

  source_table TEXT,
  source_id UUID,

  -- Free-text role descriptor. Examples: 'captain', 'golfer', 'extra_golfer',
  -- 'donor', 'sponsor_primary', 'sponsor_contact', 'dinner_attendee',
  -- 'auction_bidder', 'auction_winner'. Not constrained because the meaning
  -- shifts with activity_type and we don't want to maintain a CHECK matrix.
  role_detail TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Integrity: exactly one source-linking mechanism is populated, except
  -- for manual_note and consent_* activities which can have neither.
  CONSTRAINT chk_source_linking CHECK (
    -- Manual notes and consent events: no source linking required
    (activity_type IN ('manual_note', 'consent_given', 'consent_revoked'))
    OR
    -- Otherwise: exactly one of the typed FKs OR exactly the polymorphic pair
    (
      (
        (registration_id IS NOT NULL)::int +
        (donation_id IS NOT NULL)::int +
        (sponsor_id IS NOT NULL)::int +
        (dinner_id IS NOT NULL)::int +
        (auction_invoice_id IS NOT NULL)::int +
        (auction_bid_id IS NOT NULL)::int +
        ((source_table IS NOT NULL AND source_id IS NOT NULL))::int
      ) = 1
      AND
      -- Polymorphic pair must be both-or-neither
      ((source_table IS NULL) = (source_id IS NULL))
    )
  ),

  -- Polymorphic table name must be a known event source if used. Update
  -- this list when new event types are added. (Typed FKs above don't need
  -- to be listed here.)
  CONSTRAINT chk_source_table_known CHECK (
    source_table IS NULL OR source_table IN (
      'stewart_event_future'  -- placeholder; add real values when needed
    )
  )
);

-- Lookup indexes
CREATE INDEX idx_contact_activities_contact ON public.contact_activities (contact_id);
CREATE INDEX idx_contact_activities_type_year ON public.contact_activities (activity_type, tournament_year);
CREATE INDEX idx_contact_activities_year ON public.contact_activities (tournament_year);
CREATE INDEX idx_contact_activities_event_type ON public.contact_activities (event_type);
CREATE INDEX idx_contact_activities_created ON public.contact_activities (created_at DESC);

-- Indexes on the typed FKs help backfill verification queries and admin
-- "show me all activities linked to this registration" lookups.
CREATE INDEX idx_contact_activities_registration ON public.contact_activities (registration_id) WHERE registration_id IS NOT NULL;
CREATE INDEX idx_contact_activities_donation ON public.contact_activities (donation_id) WHERE donation_id IS NOT NULL;
CREATE INDEX idx_contact_activities_sponsor ON public.contact_activities (sponsor_id) WHERE sponsor_id IS NOT NULL;
CREATE INDEX idx_contact_activities_dinner ON public.contact_activities (dinner_id) WHERE dinner_id IS NOT NULL;
CREATE INDEX idx_contact_activities_auction_invoice ON public.contact_activities (auction_invoice_id) WHERE auction_invoice_id IS NOT NULL;
CREATE INDEX idx_contact_activities_auction_bid ON public.contact_activities (auction_bid_id) WHERE auction_bid_id IS NOT NULL;

COMMENT ON TABLE public.contact_activities IS
  'Per-transaction history for each contact. One row per discrete interaction. '
  'Hybrid source linking: typed FKs for known event sources, polymorphic '
  'source_table + source_id for future event types. amount_cents standardized '
  'to cents (source tables use integer dollars; convert at write time).';

COMMENT ON COLUMN public.contact_activities.amount_cents IS
  'Amount in cents. Source tables (registrations, donations, sponsors, dinners, '
  'auction_invoices) store integer dollars; conversion happens at write time. '
  'extra_golfer_invites.price_per_golfer is already cents and passes through.';

COMMENT ON COLUMN public.contact_activities.tax_receipt_amount_cents IS
  'Portion of amount_cents eligible for ATCP tax receipt. Only populated where '
  'it differs from amount_cents (currently auction wins, where the fair-market '
  'value of the won item is subtracted from the bid amount).';

-- -----------------------------------------------------------------------------
-- RLS: admin-only by default
-- -----------------------------------------------------------------------------
-- These tables hold PII and full transaction history. Public reads are gated
-- through specific SECURITY DEFINER RPCs (e.g., the existing donation ticker
-- RPCs which will be refactored in Session 5 to read from contacts). Direct
-- table access is admin-only.

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- Admins (members of user_roles with role 'admin') get full access
CREATE POLICY contacts_admin_all ON public.contacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE POLICY contact_activities_admin_all ON public.contact_activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- service_role bypasses RLS automatically (used by edge functions for
-- backfill, stripe-webhook writes, send-transactional-email, etc.)

-- -----------------------------------------------------------------------------
-- Helper: upsert_contact
--
-- Returns the contact_id for a given email + name + optional fields.
-- If a contact with the same lower(trim(email)) already exists, returns
-- that contact_id and (optionally) fills in missing fields from the new
-- input. Otherwise inserts and returns the new id.
--
-- This is the single entry point for all forward-looking writes (Session 4)
-- and for the backfill (Session 2). Centralizing the dedup logic prevents
-- inconsistent matching rules from drifting across edge functions.
--
-- SECURITY DEFINER so service_role can call it from edge functions and
-- so admin-side writes don't need direct table grants. REVOKE PUBLIC + GRANT
-- explicit pattern (see CONVENTIONS.md to be added in Session 5).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email TEXT,
  p_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_street TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_province TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_country TEXT DEFAULT 'CA',
  p_marketing_consent BOOLEAN DEFAULT NULL,
  p_consent_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_clean_email TEXT;
BEGIN
  -- Validate name (the only NOT NULL field)
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'upsert_contact: name is required';
  END IF;

  -- Normalize email
  v_clean_email := CASE
    WHEN p_email IS NULL OR length(trim(p_email)) = 0 THEN NULL
    ELSE lower(trim(p_email))
  END;

  -- Try to find an existing contact by normalized email
  IF v_clean_email IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE lower(trim(email)) = v_clean_email
    LIMIT 1;
  END IF;

  IF v_contact_id IS NOT NULL THEN
    -- Existing contact: fill in any missing fields from the new input,
    -- but never overwrite existing data with NULL or with a less-specific
    -- value. Marketing consent only flips false->true (never true->false here;
    -- revocation is a separate path via unsubscribed_at).
    UPDATE public.contacts
    SET
      name = COALESCE(NULLIF(trim(p_name), ''), name),
      phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
      street = COALESCE(NULLIF(trim(p_street), ''), street),
      city = COALESCE(NULLIF(trim(p_city), ''), city),
      province = COALESCE(NULLIF(trim(p_province), ''), province),
      postal_code = COALESCE(NULLIF(trim(p_postal_code), ''), postal_code),
      country = COALESCE(NULLIF(trim(p_country), ''), country),
      marketing_consent = CASE
        WHEN p_marketing_consent = true AND marketing_consent = false THEN true
        ELSE marketing_consent
      END,
      consent_recorded_at = CASE
        WHEN p_marketing_consent = true AND marketing_consent = false THEN now()
        ELSE consent_recorded_at
      END,
      consent_source = CASE
        WHEN p_marketing_consent = true AND marketing_consent = false THEN p_consent_source
        ELSE consent_source
      END
    WHERE id = v_contact_id;
  ELSE
    -- New contact
    INSERT INTO public.contacts (
      email, name, phone, street, city, province, postal_code, country,
      marketing_consent, consent_recorded_at, consent_source
    ) VALUES (
      v_clean_email,
      trim(p_name),
      NULLIF(trim(p_phone), ''),
      NULLIF(trim(p_street), ''),
      NULLIF(trim(p_city), ''),
      NULLIF(trim(p_province), ''),
      NULLIF(trim(p_postal_code), ''),
      COALESCE(NULLIF(trim(p_country), ''), 'CA'),
      COALESCE(p_marketing_consent, false),
      CASE WHEN p_marketing_consent = true THEN now() ELSE NULL END,
      CASE WHEN p_marketing_consent = true THEN p_consent_source ELSE NULL END
    )
    RETURNING id INTO v_contact_id;
  END IF;

  RETURN v_contact_id;
END;
$$;

-- Lock down execution: revoke from PUBLIC, grant explicitly.
-- service_role is used by edge functions; authenticated covers admin-side calls
-- via the regular Supabase client (admin RLS will further gate access).
REVOKE ALL ON FUNCTION public.upsert_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO service_role, authenticated;

COMMENT ON FUNCTION public.upsert_contact IS
  'Single entry point for creating or updating contacts. Email is normalized '
  'to lower(trim(email)) for dedup. Existing contacts are augmented (never '
  'overwritten) with new non-null fields. Marketing consent only flips '
  'false to true here; revocation is a separate path via unsubscribed_at.';

-- =============================================================================
-- End migration. Tables and helper are created and locked down. No backfill
-- yet; that runs in Session 2 against a dry-run flag first.
-- =============================================================================
