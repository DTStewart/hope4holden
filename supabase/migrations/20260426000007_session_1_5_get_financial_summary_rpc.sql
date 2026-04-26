-- Session 1.5 / FILE 6
--
-- get_financial_summary(p_tournament_year): aggregate financial roll-up
-- for one tournament year. Joins contact_activities (revenue, fees, COGS,
-- tax-receiptable) with event_expenses and donated_items.
--
-- All amounts in cents. Returned as JSONB for one-shot consumption by the
-- admin financial dashboard.
--
-- !! FUTURE EDITORS — READ BEFORE TOUCHING THIS FUNCTION !!
-- Use CREATE OR REPLACE FUNCTION (preserves grants). DROP + CREATE would
-- silently re-grant EXECUTE to PUBLIC and reopen this to anon callers.
-- This function returns financial detail and must NEVER be anon-callable.

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
  -- Gross revenue
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_gross_revenue
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  -- Revenue by activity type
  SELECT COALESCE(jsonb_object_agg(activity_type, total), '{}'::jsonb)
    INTO v_revenue_by_type
  FROM (
    SELECT activity_type, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.contact_activities
    WHERE tournament_year = p_tournament_year
    GROUP BY activity_type
  ) t;

  -- Revenue by processor (NULL bucket coalesced to 'unknown')
  SELECT COALESCE(jsonb_object_agg(COALESCE(payment_processor, 'unknown'), total), '{}'::jsonb)
    INTO v_revenue_by_processor
  FROM (
    SELECT payment_processor, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.contact_activities
    WHERE tournament_year = p_tournament_year
    GROUP BY payment_processor
  ) t;

  -- Processor fees
  SELECT COALESCE(SUM(processor_fee_cents), 0) INTO v_processor_fees
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  -- Cost of goods
  SELECT COALESCE(SUM(cost_of_goods_cents), 0) INTO v_cost_of_goods
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year;

  -- Event expenses total
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_expenses
  FROM public.event_expenses
  WHERE tournament_year = p_tournament_year;

  -- Expenses by category
  SELECT COALESCE(jsonb_object_agg(category, total), '{}'::jsonb)
    INTO v_expenses_by_category
  FROM (
    SELECT category, COALESCE(SUM(amount_cents), 0) AS total
    FROM public.event_expenses
    WHERE tournament_year = p_tournament_year
    GROUP BY category
  ) t;

  -- Tax-receiptable: activities marked eligible AND donor requested receipt
  SELECT COALESCE(SUM(tax_receipt_amount_cents), 0) INTO v_tax_receiptable
  FROM public.contact_activities
  WHERE tournament_year = p_tournament_year
    AND tax_receipt_eligible = true
    AND receipt_requested = true;

  -- In-kind donations (FMV of donated items the donor wants a receipt for)
  SELECT COALESCE(SUM(fair_market_value_cents), 0) INTO v_in_kind
  FROM public.donated_items
  WHERE tournament_year = p_tournament_year
    AND receipt_requested = true;

  -- Net = gross - processor fees - COGS - expenses
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
