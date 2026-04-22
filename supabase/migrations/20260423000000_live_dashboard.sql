-- Live event dashboard: public projector-friendly page at /live.
--
-- Adds:
--   - live_dashboard_settings: singleton row of section-visibility toggles
--   - rainbow_auction_winners: admin-entered list shown on the live dashboard
--   - get_live_dashboard_state(): one-roundtrip fetch for the whole view


-- 1. Singleton settings (section visibility + refresh interval)
CREATE TABLE public.live_dashboard_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_auction BOOLEAN NOT NULL DEFAULT true,
  show_leaderboard BOOLEAN NOT NULL DEFAULT true,
  show_rainbow BOOLEAN NOT NULL DEFAULT true,
  show_fundraising BOOLEAN NOT NULL DEFAULT true,
  refresh_interval_seconds INT NOT NULL DEFAULT 30 CHECK (refresh_interval_seconds BETWEEN 5 AND 600),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.live_dashboard_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.live_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Public read so the live page can check toggles without auth.
CREATE POLICY "Anyone can read live dashboard settings"
  ON public.live_dashboard_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update live dashboard settings"
  ON public.live_dashboard_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_live_dashboard_settings_updated_at
  BEFORE UPDATE ON public.live_dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Rainbow auction winners (entered live by admin during the dinner)
CREATE TABLE public.rainbow_auction_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_description TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  amount INTEGER,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rainbow_auction_winners_sort_idx
  ON public.rainbow_auction_winners(sort_order, created_at);

ALTER TABLE public.rainbow_auction_winners ENABLE ROW LEVEL SECURITY;

-- Public read so the live page can display the running list.
CREATE POLICY "Anyone can read rainbow winners"
  ON public.rainbow_auction_winners FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage rainbow winners"
  ON public.rainbow_auction_winners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_rainbow_auction_winners_updated_at
  BEFORE UPDATE ON public.rainbow_auction_winners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Single-roundtrip fetch for the live dashboard.
--
-- Returns JSON with: settings, top 5 auction items (with current high bid),
-- rainbow winners, leaderboard (verified, non-DQ), and fundraising totals.
-- Uses SECURITY DEFINER so the anon key can call it without direct table
-- access to donations/registrations/etc.
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

  -- Top 5 auction items by current high bid (fall back to starting_bid when
  -- there are no bids yet). Only items that are open or closed — not drafts.
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
      (SELECT COUNT(*) FROM public.auction_bids b WHERE b.item_id = i.id) AS bid_count
    FROM public.auction_items i
    WHERE i.status IN ('open', 'closed')
    ORDER BY current_bid DESC
    LIMIT 5
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


-- 4. Realtime: bids and scorecards already have realtime via earlier migrations
-- (see 20260422040000 / 20260422070000). Enable realtime for rainbow_auction_winners
-- so admin-entered winners appear on the projector without a poll.
ALTER PUBLICATION supabase_realtime ADD TABLE public.rainbow_auction_winners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_dashboard_settings;
