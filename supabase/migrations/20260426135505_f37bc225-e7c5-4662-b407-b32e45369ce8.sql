-- Session 1.5 / FILE 0: contacts SMS consent + volunteer role
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_source TEXT;

COMMENT ON COLUMN public.contacts.sms_consent IS
  'Contact opted in to SMS messages. Default false (opt-in only). Independent of marketing_consent.';
COMMENT ON COLUMN public.contacts.sms_consent_recorded_at IS
  'Timestamp when sms_consent was last set to true. Null if never opted in.';
COMMENT ON COLUMN public.contacts.sms_consent_source IS
  'Where SMS consent was collected (e.g. ''checkout-form'', ''admin-entry'', ''day-of-event'').';

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'volunteer';

-- Session 1.5 / FILE 1: contact_activities expansion
ALTER TABLE public.contact_activities
  DROP CONSTRAINT contact_activities_activity_type_check;

ALTER TABLE public.contact_activities
  ADD CONSTRAINT contact_activities_activity_type_check CHECK (activity_type IN (
    'team_registration','extra_golfer','donation','sponsorship','dinner_ticket',
    'auction_bid','auction_win','manual_note','consent_given','consent_revoked',
    'merchandise_sale','event_addon','silent_auction_win','rainbow_auction_ticket','mulligan'
  ));

ALTER TABLE public.contact_activities
  ADD COLUMN IF NOT EXISTS processor_fee_cents BIGINT,
  ADD COLUMN IF NOT EXISTS payment_processor TEXT,
  ADD COLUMN IF NOT EXISTS cost_of_goods_cents BIGINT,
  ADD COLUMN IF NOT EXISTS tax_receipt_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS receipt_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS donated_item_id UUID;

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

-- Session 1.5 / FILE 2: donated_items
CREATE TABLE public.donated_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_description TEXT,
  fair_market_value_cents BIGINT NOT NULL CHECK (fair_market_value_cents >= 0),
  donor_fmv_basis TEXT,
  tournament_year INTEGER NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'h4h_golf',
  intended_format TEXT DEFAULT 'silent'
    CHECK (intended_format IN ('silent', 'rainbow', 'unused')),
  auction_item_id UUID,
  rainbow_prize_id UUID,
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

-- Session 1.5 / FILE 3: auction_items extension
ALTER TABLE public.auction_items
  ADD COLUMN IF NOT EXISTS donated_item_id UUID
    REFERENCES public.donated_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retail_value_cents BIGINT,
  ADD COLUMN IF NOT EXISTS cost_to_event_cents BIGINT;

UPDATE public.auction_items
SET retail_value_cents = market_value * 100
WHERE retail_value_cents IS NULL;

COMMENT ON COLUMN public.auction_items.donated_item_id IS
  'Link to the in-kind donated_items row if this auction item came from an in-kind donation. Null for items the event purchased.';
COMMENT ON COLUMN public.auction_items.retail_value_cents IS
  'FMV displayed at auction in cents. Drives tax-receipt math (winning_amount - retail_value = receipt-eligible). Backfilled from market_value * 100; market_value remains in dollars for backwards compat.';
COMMENT ON COLUMN public.auction_items.cost_to_event_cents IS
  'What the event paid for the item if purchased rather than donated. Null when the item was donated.';

ALTER TABLE public.donated_items
  ADD CONSTRAINT fk_donated_items_auction_item
  FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(id) ON DELETE SET NULL;

-- Session 1.5 / FILE 4: rainbow auction prizes
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

CREATE POLICY "Admins can manage rainbow auction prizes"
  ON public.rainbow_auction_prizes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rainbow_auction_prizes_updated_at
  BEFORE UPDATE ON public.rainbow_auction_prizes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rainbow_auction_winners
  ADD COLUMN IF NOT EXISTS prize_id UUID
    REFERENCES public.rainbow_auction_prizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winner_contact_id UUID
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS winning_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS tournament_year INTEGER;

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

ALTER TABLE public.donated_items
  ADD CONSTRAINT fk_donated_items_rainbow_prize
  FOREIGN KEY (rainbow_prize_id) REFERENCES public.rainbow_auction_prizes(id) ON DELETE SET NULL;

-- Session 1.5 / FILE 5: event_expenses
CREATE TABLE public.event_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'venue','food_beverage','prizes','merchandise_cogs','printing',
    'tech_software','payment_processing','marketing','auction_items_purchased','other'
  )),
  description TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  payment_method TEXT CHECK (payment_method IN (
    'corporate_card','personal_card_reimbursed','cheque','eft','cash','other'
  )),
  tournament_year INTEGER NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_event_expenses_year ON public.event_expenses(tournament_year);
CREATE INDEX idx_event_expenses_category ON public.event_expenses(category);

ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage event expenses"
  ON public.event_expenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_event_expenses_updated_at
  BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.event_expenses IS
  'Cost-side ledger for the tournament. Joined with contact_activities revenue in get_financial_summary to compute net funds available.';
COMMENT ON COLUMN public.event_expenses.amount_cents IS
  'Expense amount in cents. BIGINT matches the Session 1.5 cents convention used by the financial RPCs.';
COMMENT ON COLUMN public.event_expenses.receipt_url IS
  'Storage URL or external link to the receipt/invoice. No bucket convention enforced yet.';

-- Session 1.5 / FILE 6: get_financial_summary RPC
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_tournament_year INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_gross_revenue       BIGINT;
  v_revenue_by_type     JSONB;
  v_revenue_by_processor JSONB;
  v_processor_fees      BIGINT;
  v_cost_of_goods       BIGINT;
  v_total_expenses      BIGINT;
  v_expenses_by_category JSONB;
  v_tax_receiptable     BIGINT;
  v_in_kind             BIGINT;
  v_net                 BIGINT;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_gross_revenue
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  SELECT COALESCE(jsonb_object_agg(activity_type, total), '{}'::jsonb)
    INTO v_revenue_by_type
  FROM (
    SELECT activity_type, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.contact_activities
    WHERE tournament_year = p_tournament_year
    GROUP BY activity_type
  ) t;

  SELECT COALESCE(jsonb_object_agg(COALESCE(payment_processor, 'unknown'), total), '{}'::jsonb)
    INTO v_revenue_by_processor
  FROM (
    SELECT payment_processor, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.contact_activities
    WHERE tournament_year = p_tournament_year
    GROUP BY payment_processor
  ) t;

  SELECT COALESCE(SUM(processor_fee_cents), 0) INTO v_processor_fees
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  SELECT COALESCE(SUM(cost_of_goods_cents), 0) INTO v_cost_of_goods
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_expenses
  FROM public.event_expenses
  WHERE tournament_year = p_tournament_year;

  SELECT COALESCE(jsonb_object_agg(category, total), '{}'::jsonb)
    INTO v_expenses_by_category
  FROM (
    SELECT category, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.event_expenses
    WHERE tournament_year = p_tournament_year
    GROUP BY category
  ) t;

  SELECT COALESCE(SUM(tax_receipt_amount_cents), 0) INTO v_tax_receiptable
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year
    AND tax_receipt_eligible = true
    AND receipt_requested = true;

  SELECT COALESCE(SUM(fair_market_value_cents), 0) INTO v_in_kind
  FROM public.donated_items
  WHERE tournament_year = p_tournament_year
    AND receipt_requested = true;

  v_net := v_gross_revenue - v_processor_fees - v_cost_of_goods - v_total_expenses;

  RETURN jsonb_build_object(
    'tournament_year',          p_tournament_year,
    'gross_revenue_cents',      v_gross_revenue,
    'revenue_by_activity_type', v_revenue_by_type,
    'revenue_by_processor',     v_revenue_by_processor,
    'processor_fees_cents',     v_processor_fees,
    'cost_of_goods_cents',      v_cost_of_goods,
    'total_expenses_cents',     v_total_expenses,
    'expenses_by_category',     v_expenses_by_category,
    'net_funds_available_cents', v_net,
    'tax_receiptable_cents',    v_tax_receiptable,
    'in_kind_donations_cents',  v_in_kind,
    'last_calculated_at',       now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_financial_summary(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_summary(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_financial_summary IS
  'Returns a financial roll-up for the given tournament_year. Aggregates contact_activities (revenue, fees, COGS, tax-receiptable) and event_expenses. authenticated users only — never anon.';

-- Session 1.5 / FILE 7: get_live_display_state RPC
CREATE OR REPLACE FUNCTION public.get_live_display_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_year             INTEGER;
  v_gross_revenue    BIGINT;
  v_donor_count      INTEGER;
  v_recent_donations JSONB;
  v_silent_top       JSONB;
  v_rainbow_prizes   JSONB;
  v_rainbow_tickets  BIGINT;
BEGIN
  v_year := public.get_current_tournament_year();

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_gross_revenue
  FROM public.contact_activities
  WHERE tournament_year = v_year;

  SELECT COUNT(DISTINCT contact_id) INTO v_donor_count
  FROM public.contact_activities
  WHERE tournament_year = v_year
    AND activity_type = 'donation';

  SELECT COALESCE(jsonb_agg(to_jsonb(d.*) ORDER BY d.created_at DESC), '[]'::jsonb)
    INTO v_recent_donations
  FROM (
    SELECT
      CASE
        WHEN c.public_display_consent = true THEN
          COALESCE(NULLIF(TRIM(c.public_display_name), ''), c.name, 'A friend of Holden')
        ELSE 'A friend of Holden'
      END AS display_name,
      a.amount_cents,
      a.created_at
    FROM public.contact_activities a
    LEFT JOIN public.contacts c ON c.id = a.contact_id
    WHERE a.tournament_year = v_year
      AND a.activity_type = 'donation'
    ORDER BY a.created_at DESC
    LIMIT 20
  ) d;

  SELECT COALESCE(jsonb_agg(to_jsonb(i.*) ORDER BY i.current_bid_cents DESC), '[]'::jsonb)
    INTO v_silent_top
  FROM (
    SELECT
      ai.title AS item_name,
      (COALESCE(
        (SELECT MAX(b.amount) FROM public.auction_bids b WHERE b.item_id = ai.id),
        ai.starting_bid
      )) * 100 AS current_bid_cents,
      ai.images->0->>'url' AS photo_url
    FROM public.auction_items ai
    WHERE ai.status IN ('open', 'closed')
    ORDER BY current_bid_cents DESC
    LIMIT 5
  ) i;

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.sort_order), '[]'::jsonb)
    INTO v_rainbow_prizes
  FROM (
    SELECT prize_name, retail_value_cents, sort_order
    FROM public.rainbow_auction_prizes
    WHERE tournament_year = v_year
      AND is_displayed = true
    ORDER BY sort_order
  ) p;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_rainbow_tickets
  FROM public.contact_activities
  WHERE tournament_year = v_year
    AND activity_type = 'rainbow_auction_ticket';

  RETURN jsonb_build_object(
    'tournament_year',           v_year,
    'gross_revenue_cents',       v_gross_revenue,
    'donor_count',               v_donor_count,
    'recent_donations',          v_recent_donations,
    'silent_auction_top_items',  v_silent_top,
    'rainbow_prizes',            v_rainbow_prizes,
    'rainbow_tickets_sold_cents', v_rainbow_tickets,
    'generated_at',              now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_display_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_display_state() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_live_display_state IS
  'Single-roundtrip projector state for the live event display. Reads tournament year from settings via get_current_tournament_year(). Anon-callable. Does not replace get_live_dashboard_state(); the older RPC remains for the existing /live page until that page migrates to the new shape.';