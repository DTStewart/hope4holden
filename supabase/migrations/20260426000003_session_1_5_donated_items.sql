-- Session 1.5 / FILE 2
--
-- donated_items: in-kind donations contributed by contacts for use at the event.
-- A donated item flows into either the silent auction (auction_item_id) or
-- the rainbow auction (rainbow_prize_id), or remains unused. The
-- receipt_requested flag drives the in-kind portion of the donor's tax
-- receipt math in get_financial_summary.
--
-- The auction_item_id and rainbow_prize_id FK constraints are added in
-- FILE 3 and FILE 4 respectively, after their target tables exist.

CREATE TABLE public.donated_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  donor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  fair_market_value_cents BIGINT NOT NULL CHECK (fair_market_value_cents >= 0),

  -- Free text where the donor explains how they arrived at FMV
  -- (e.g., "retail price at Canadian Tire", "appraisal attached").
  donor_fmv_basis TEXT,

  tournament_year INTEGER NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'h4h_golf',

  intended_format TEXT DEFAULT 'silent'
    CHECK (intended_format IN ('silent', 'rainbow', 'unused')),

  auction_item_id UUID,    -- FK added in FILE 3
  rainbow_prize_id UUID,   -- FK added in FILE 4

  receipt_requested BOOLEAN NOT NULL DEFAULT false,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_donated_items_donor ON public.donated_items(donor_contact_id);
CREATE INDEX idx_donated_items_year ON public.donated_items(tournament_year);

ALTER TABLE public.donated_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage donated items"
  ON public.donated_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_donated_items_updated_at
  BEFORE UPDATE ON public.donated_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Backfill the contact_activities.donated_item_id FK now that donated_items exists.
ALTER TABLE public.contact_activities
  ADD CONSTRAINT fk_contact_activities_donated_item
  FOREIGN KEY (donated_item_id) REFERENCES public.donated_items(id) ON DELETE SET NULL;


COMMENT ON TABLE public.donated_items IS
  'In-kind donations: physical items contributed by donors for use at the event. Links to auction_items or rainbow_auction_prizes once placed.';
COMMENT ON COLUMN public.donated_items.fair_market_value_cents IS
  'Donor-stated FMV in cents. Cents convention matches the Session 1.5 financial RPCs.';
COMMENT ON COLUMN public.donated_items.donor_fmv_basis IS
  'Donor''s explanation of how they arrived at the FMV. Required for ATCP receipt-eligible items.';
COMMENT ON COLUMN public.donated_items.intended_format IS
  'Where the donor intends the item to be used. Admin can override at placement time.';
COMMENT ON COLUMN public.donated_items.receipt_requested IS
  'Donor wants an in-kind tax receipt for this item. Drives in_kind_donations_cents in get_financial_summary.';
