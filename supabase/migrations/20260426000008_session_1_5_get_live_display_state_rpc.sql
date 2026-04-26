-- Session 1.5 / FILE 7
--
-- get_live_display_state(): single-roundtrip projector state for the live
-- event display. Reads the current tournament year from settings via
-- the existing get_current_tournament_year() helper. Returns a JSONB blob
-- with totals, recent donations, top auction items, and rainbow prizes.
--
-- Anon-callable: the live screen has no authentication. SECURITY DEFINER
-- bypasses RLS on the underlying tables (notably rainbow_auction_prizes
-- which is admin-only at the table level).
--
-- !! FUTURE EDITORS — READ BEFORE TOUCHING THIS FUNCTION !!
-- Use CREATE OR REPLACE FUNCTION to preserve grants. DROP + CREATE would
-- still re-grant EXECUTE to PUBLIC — which is fine here because the function
-- IS public-readable — but you'd lose the explicit anon grant and the
-- function would fall back to PUBLIC's default permissions. Keep the
-- explicit REVOKE + GRANT pair below in any reapplication.
--
-- Drift notes:
-- 1. auction_items.current_bid does not exist as a column. Computed from
--    MAX(auction_bids.amount) per item, fallback to starting_bid.
-- 2. auction_items photo lives in images jsonb (array of {url, alt}); we
--    pull images->0->>'url'.
-- 3. auction_items.market_value/starting_bid are DOLLARS; we multiply by
--    100 to expose current_bid_cents.

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

  -- Gross revenue for the current year
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_gross_revenue
  FROM public.contact_activities
  WHERE tournament_year = v_year;

  -- Distinct donor count (contacts with at least one donation activity this year)
  SELECT COUNT(DISTINCT contact_id) INTO v_donor_count
  FROM public.contact_activities
  WHERE tournament_year = v_year
    AND activity_type = 'donation';

  -- Recent 20 donation activities; respect public_display_consent
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

  -- Silent auction top 5 items by current bid (computed)
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

  -- Rainbow prizes (current year, displayed only)
  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.sort_order), '[]'::jsonb)
    INTO v_rainbow_prizes
  FROM (
    SELECT prize_name, retail_value_cents, sort_order
    FROM public.rainbow_auction_prizes
    WHERE tournament_year = v_year
      AND is_displayed = true
    ORDER BY sort_order
  ) p;

  -- Rainbow tickets sold (sum of rainbow_auction_ticket activities)
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
