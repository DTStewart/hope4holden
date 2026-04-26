-- =============================================================================
-- Hope 4 Holden CRM Foundation
-- Migration: contacts + contact_activities
-- =============================================================================

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'CA',
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at TIMESTAMPTZ,
  consent_source TEXT,
  unsubscribed_at TIMESTAMPTZ,
  public_display_consent BOOLEAN NOT NULL DEFAULT false,
  public_display_name TEXT,
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contacts_email_lower
  ON public.contacts (lower(trim(email)))
  WHERE email IS NOT NULL;

CREATE INDEX idx_contacts_name_lower ON public.contacts (lower(name));
CREATE INDEX idx_contacts_phone ON public.contacts (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_contacts_marketing_consent ON public.contacts (marketing_consent) WHERE marketing_consent = true;
CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags);

CREATE OR REPLACE FUNCTION public.contacts_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
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
  'Unified contact directory. Each row is a unique person (or organization in the case of sponsor primary contacts) deduplicated by lower(trim(email)). See contact_activities for the per-transaction history.';

COMMENT ON COLUMN public.contacts.marketing_consent IS
  'CASL marketing consent. Default false (active opt-in required). When true, consent_recorded_at and consent_source must be populated. unsubscribed_at, when set, supersedes this field.';

COMMENT ON COLUMN public.contacts.public_display_consent IS
  'Consent to display this contact as a supporter on public pages (donation ticker, future donor walls). Migrated from donations.public_display_consent in Session 5 of the CRM build.';

CREATE TABLE public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'team_registration',
    'extra_golfer',
    'donation',
    'sponsorship',
    'dinner_ticket',
    'auction_bid',
    'auction_win',
    'manual_note',
    'consent_given',
    'consent_revoked'
  )),
  tournament_year INTEGER,
  event_type TEXT NOT NULL DEFAULT 'h4h_golf',
  amount_cents BIGINT,
  tax_receipt_amount_cents BIGINT,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
  sponsor_id UUID REFERENCES public.sponsors(id) ON DELETE SET NULL,
  dinner_id UUID REFERENCES public.dinners(id) ON DELETE SET NULL,
  auction_invoice_id UUID REFERENCES public.auction_invoices(id) ON DELETE SET NULL,
  auction_bid_id UUID REFERENCES public.auction_bids(id) ON DELETE SET NULL,
  source_table TEXT,
  source_id UUID,
  role_detail TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_source_linking CHECK (
    (activity_type IN ('manual_note', 'consent_given', 'consent_revoked'))
    OR
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
      ((source_table IS NULL) = (source_id IS NULL))
    )
  ),
  CONSTRAINT chk_source_table_known CHECK (
    source_table IS NULL OR source_table IN (
      'stewart_event_future'
    )
  )
);

CREATE INDEX idx_contact_activities_contact ON public.contact_activities (contact_id);
CREATE INDEX idx_contact_activities_type_year ON public.contact_activities (activity_type, tournament_year);
CREATE INDEX idx_contact_activities_year ON public.contact_activities (tournament_year);
CREATE INDEX idx_contact_activities_event_type ON public.contact_activities (event_type);
CREATE INDEX idx_contact_activities_created ON public.contact_activities (created_at DESC);

CREATE INDEX idx_contact_activities_registration ON public.contact_activities (registration_id) WHERE registration_id IS NOT NULL;
CREATE INDEX idx_contact_activities_donation ON public.contact_activities (donation_id) WHERE donation_id IS NOT NULL;
CREATE INDEX idx_contact_activities_sponsor ON public.contact_activities (sponsor_id) WHERE sponsor_id IS NOT NULL;
CREATE INDEX idx_contact_activities_dinner ON public.contact_activities (dinner_id) WHERE dinner_id IS NOT NULL;
CREATE INDEX idx_contact_activities_auction_invoice ON public.contact_activities (auction_invoice_id) WHERE auction_invoice_id IS NOT NULL;
CREATE INDEX idx_contact_activities_auction_bid ON public.contact_activities (auction_bid_id) WHERE auction_bid_id IS NOT NULL;

COMMENT ON TABLE public.contact_activities IS
  'Per-transaction history for each contact. One row per discrete interaction. Hybrid source linking: typed FKs for known event sources, polymorphic source_table + source_id for future event types. amount_cents standardized to cents (source tables use integer dollars; convert at write time).';

COMMENT ON COLUMN public.contact_activities.amount_cents IS
  'Amount in cents. Source tables (registrations, donations, sponsors, dinners, auction_invoices) store integer dollars; conversion happens at write time. extra_golfer_invites.price_per_golfer is already cents and passes through.';

COMMENT ON COLUMN public.contact_activities.tax_receipt_amount_cents IS
  'Portion of amount_cents eligible for ATCP tax receipt. Only populated where it differs from amount_cents (currently auction wins, where the fair-market value of the won item is subtracted from the bid amount).';

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

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
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'upsert_contact: name is required';
  END IF;

  v_clean_email := CASE
    WHEN p_email IS NULL OR length(trim(p_email)) = 0 THEN NULL
    ELSE lower(trim(p_email))
  END;

  IF v_clean_email IS NOT NULL THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE lower(trim(email)) = v_clean_email
    LIMIT 1;
  END IF;

  IF v_contact_id IS NOT NULL THEN
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

REVOKE ALL ON FUNCTION public.upsert_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_contact(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
) TO service_role, authenticated;

COMMENT ON FUNCTION public.upsert_contact IS
  'Single entry point for creating or updating contacts. Email is normalized to lower(trim(email)) for dedup. Existing contacts are augmented (never overwritten) with new non-null fields. Marketing consent only flips false to true here; revocation is a separate path via unsubscribed_at.';