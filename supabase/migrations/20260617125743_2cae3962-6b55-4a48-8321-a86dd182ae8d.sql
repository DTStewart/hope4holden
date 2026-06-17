-- Add high_bidder_name to the /live dashboard auction items and return ALL
-- non-draft items (not just top 5).
--
-- high_bidder_name is resolved INSIDE this SECURITY DEFINER function by joining
-- the leading bid to auction_bidders, exposing ONLY display_name. No bidder_id,
-- email, phone, stripe_customer_id, payment_method_id, or session_token is
-- returned, and auction_bidders stays admin-only for direct reads (the definer
-- context is what makes this read legal). Items with no bids get a null
-- high_bidder_name and current_bid falls back to starting_bid, as before.
--
-- Everything else (settings, rainbow winners, leaderboard, fundraising) is
-- preserved verbatim. CREATE OR REPLACE keeps the existing anon/authenticated
-- EXECUTE grants; they are re-stated below defensively.
CREATE OR REPLACE FUNCTION public.get_live_dashboard_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_team_price CONSTANT INTEGER := 600;  -- keep in sync with DashboardStats.tsx
  v_settings JSONB;
  v_items JSONB;
  v_rainbow JSONB;
  v_leaderboard JSONB;
  v_teams_count INTEGER;
  v_sponsors_total INTEGER;
  v_donations_total INTEGER;
  v_dinners_total INTEGER;
  v_total_raised INTEGER;
BEGIN
  SELECT to_jsonb(s.*) INTO v_settings
  FROM public.live_dashboard_settings s WHERE s.id = 1;

  -- ALL non-draft (open/closed) auction items by current high bid (fall back to
  -- starting_bid when there are no bids yet). high_bidder_name is the display_name
  -- of the bidder holding the leading (MAX amount) bid for the item, resolved here
  -- under SECURITY DEFINER; only display_name is exposed, never any other bidder field.
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.current_bid DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      i.id,
      i.title,
      i.images,
      i.starting_bid,
      i.status,
      COALESCE(
        (SELECT MAX(b.amount) FROM public.auction_bids b WHERE b.item_id = i.id),
        i.starting_bid
      ) AS current_bid,
      (SELECT COUNT(*) FROM public.auction_bids b WHERE b.item_id = i.id) AS bid_count,
      (
        SELECT bd.display_name
        FROM public.auction_bids b
        JOIN public.auction_bidders bd ON bd.id = b.bidder_id
        WHERE b.item_id = i.id
        ORDER BY b.amount DESC, b.created_at ASC
        LIMIT 1
      ) AS high_bidder_name
    FROM public.auction_items i
    WHERE i.status IN ('open', 'closed')
    ORDER BY current_bid DESC
  ) t;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'prize_description', prize_description,
      'winner_name', winner_name,
      'amount', amount,
      'sort_order', sort_order
    ) ORDER BY sort_order, created_at
  ), '[]'::jsonb) INTO v_rainbow
  FROM public.rainbow_auction_winners;

  -- Leaderboard: top 10 verified, non-DQ teams (lowest score wins in golf).
  SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_leaderboard
  FROM (
    SELECT
      r.id AS registration_id,
      r.team_name,
      r.business_name,
      r.team_photo_url,
      s.final_score
    FROM public.scorecard_submissions s
    JOIN public.registrations r ON r.id = s.registration_id
    WHERE s.verified = true AND s.disqualified = false
    ORDER BY s.final_score ASC, s.created_at ASC
    LIMIT 10
  ) l;

  -- Fundraising total — mirrors DashboardStats.tsx.
  SELECT COUNT(*) INTO v_teams_count
  FROM public.registrations WHERE paid = true;

  SELECT COALESCE(SUM(amount), 0) INTO v_sponsors_total
  FROM public.sponsors WHERE paid = true;

  SELECT COALESCE(SUM(amount), 0) INTO v_donations_total
  FROM public.donations WHERE paid = true;

  SELECT COALESCE(SUM(amount), 0) INTO v_dinners_total
  FROM public.dinners WHERE paid = true;

  v_total_raised := v_teams_count * v_team_price
                    + v_sponsors_total
                    + v_donations_total
                    + v_dinners_total;

  RETURN jsonb_build_object(
    'settings', v_settings,
    'top_items', v_items,
    'rainbow_winners', v_rainbow,
    'leaderboard', v_leaderboard,
    'fundraising', jsonb_build_object(
      'total_raised', v_total_raised,
      'teams_count', v_teams_count,
      'sponsors_total', v_sponsors_total,
      'donations_total', v_donations_total,
      'dinners_total', v_dinners_total
    ),
    'generated_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_live_dashboard_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_dashboard_state() TO anon, authenticated;
