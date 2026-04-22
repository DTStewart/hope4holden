-- Consolidated: live_dashboard + ugc_photos + donations_method + fundraising_total + next_year_interest

-- ============ 1. live_dashboard ============
CREATE TABLE IF NOT EXISTS public.live_dashboard_settings (
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
DROP POLICY IF EXISTS "Anyone can read live dashboard settings" ON public.live_dashboard_settings;
CREATE POLICY "Anyone can read live dashboard settings"
  ON public.live_dashboard_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can update live dashboard settings" ON public.live_dashboard_settings;
CREATE POLICY "Admins can update live dashboard settings"
  ON public.live_dashboard_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS update_live_dashboard_settings_updated_at ON public.live_dashboard_settings;
CREATE TRIGGER update_live_dashboard_settings_updated_at
  BEFORE UPDATE ON public.live_dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.rainbow_auction_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_description TEXT NOT NULL,
  winner_name TEXT NOT NULL,
  amount INTEGER,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rainbow_auction_winners_sort_idx
  ON public.rainbow_auction_winners(sort_order, created_at);
ALTER TABLE public.rainbow_auction_winners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read rainbow winners" ON public.rainbow_auction_winners;
CREATE POLICY "Anyone can read rainbow winners"
  ON public.rainbow_auction_winners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage rainbow winners" ON public.rainbow_auction_winners;
CREATE POLICY "Admins can manage rainbow winners"
  ON public.rainbow_auction_winners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS update_rainbow_auction_winners_updated_at ON public.rainbow_auction_winners;
CREATE TRIGGER update_rainbow_auction_winners_updated_at
  BEFORE UPDATE ON public.rainbow_auction_winners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_live_dashboard_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_team_price CONSTANT INTEGER := 600;
  v_settings JSONB; v_items JSONB; v_rainbow JSONB; v_leaderboard JSONB;
  v_teams_count INTEGER; v_sponsors_total INTEGER; v_donations_total INTEGER;
  v_dinners_total INTEGER; v_total_raised INTEGER;
BEGIN
  SELECT to_jsonb(s.*) INTO v_settings FROM public.live_dashboard_settings s WHERE s.id = 1;
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.current_bid DESC), '[]'::jsonb) INTO v_items
  FROM (
    SELECT i.id, i.title, i.images, i.starting_bid, i.status,
      COALESCE((SELECT MAX(b.amount) FROM public.auction_bids b WHERE b.item_id = i.id), i.starting_bid) AS current_bid,
      (SELECT COUNT(*) FROM public.auction_bids b WHERE b.item_id = i.id) AS bid_count
    FROM public.auction_items i WHERE i.status IN ('open', 'closed')
    ORDER BY current_bid DESC LIMIT 5
  ) t;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'prize_description', prize_description,
    'winner_name', winner_name, 'amount', amount, 'sort_order', sort_order)
    ORDER BY sort_order, created_at), '[]'::jsonb) INTO v_rainbow
  FROM public.rainbow_auction_winners;
  SELECT COALESCE(jsonb_agg(row_to_json(l)), '[]'::jsonb) INTO v_leaderboard
  FROM (
    SELECT r.id AS registration_id, r.team_name, r.business_name, r.team_photo_url, s.final_score
    FROM public.scorecard_submissions s JOIN public.registrations r ON r.id = s.registration_id
    WHERE s.verified = true AND s.disqualified = false
    ORDER BY s.final_score ASC, s.created_at ASC LIMIT 10
  ) l;
  SELECT COUNT(*) INTO v_teams_count FROM public.registrations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_sponsors_total FROM public.sponsors WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_donations_total FROM public.donations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_dinners_total FROM public.dinners WHERE paid = true;
  v_total_raised := v_teams_count * v_team_price + v_sponsors_total + v_donations_total + v_dinners_total;
  RETURN jsonb_build_object('settings', v_settings, 'top_items', v_items, 'rainbow_winners', v_rainbow,
    'leaderboard', v_leaderboard,
    'fundraising', jsonb_build_object('total_raised', v_total_raised, 'teams_count', v_teams_count,
      'sponsors_total', v_sponsors_total, 'donations_total', v_donations_total, 'dinners_total', v_dinners_total),
    'generated_at', now());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_live_dashboard_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_dashboard_state() TO anon, authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rainbow_auction_winners;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_dashboard_settings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. ugc_photos ============
CREATE TABLE IF NOT EXISTS public.ugc_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  submitter_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ugc_photos_status_idx ON public.ugc_photos(status, created_at DESC);
CREATE INDEX IF NOT EXISTS ugc_photos_registration_idx ON public.ugc_photos(registration_id);
ALTER TABLE public.ugc_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage UGC photos" ON public.ugc_photos;
CREATE POLICY "Admins can manage UGC photos"
  ON public.ugc_photos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP TRIGGER IF EXISTS update_ugc_photos_updated_at ON public.ugc_photos;
CREATE TRIGGER update_ugc_photos_updated_at
  BEFORE UPDATE ON public.ugc_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('ugc-photos', 'ugc-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view UGC photos" ON storage.objects;
CREATE POLICY "Anyone can view UGC photos"
  ON storage.objects FOR SELECT USING (bucket_id = 'ugc-photos');
DROP POLICY IF EXISTS "Admins can manage UGC photo objects" ON storage.objects;
CREATE POLICY "Admins can manage UGC photo objects"
  ON storage.objects FOR ALL
  USING (bucket_id = 'ugc-photos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'ugc-photos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.submit_team_ugc(_token UUID, _photo_url TEXT, _caption TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_registration_id UUID; v_pending_count INTEGER;
BEGIN
  IF _token IS NULL OR _photo_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_fields');
  END IF;
  SELECT id INTO v_registration_id FROM public.registrations
  WHERE score_token = _token AND paid = true;
  IF v_registration_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  SELECT COUNT(*) INTO v_pending_count FROM public.ugc_photos
  WHERE registration_id = v_registration_id AND status = 'pending';
  IF v_pending_count >= 50 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_pending');
  END IF;
  INSERT INTO public.ugc_photos (registration_id, photo_url, caption)
  VALUES (v_registration_id, _photo_url, NULLIF(btrim(_caption), ''));
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_team_ugc(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_team_ugc(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_approved_ugc(_limit INT DEFAULT 50)
RETURNS TABLE (id UUID, photo_url TEXT, caption TEXT, team_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT u.id, u.photo_url, u.caption, r.team_name, u.created_at
  FROM public.ugc_photos u JOIN public.registrations r ON r.id = u.registration_id
  WHERE u.status = 'approved'
  ORDER BY u.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;
REVOKE EXECUTE ON FUNCTION public.get_approved_ugc(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_approved_ugc(INT) TO anon, authenticated;

-- ============ 3. donations method ============
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'stripe'
    CHECK (method IN ('stripe', 'cash', 'cheque', 'eft', 'other'));
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS admin_note TEXT;
CREATE INDEX IF NOT EXISTS donations_method_idx ON public.donations(method);

-- ============ 4. fundraising total RPC ============
CREATE OR REPLACE FUNCTION public.get_fundraising_total()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_team_price CONSTANT INTEGER := 600;
  v_teams INTEGER; v_sponsors INTEGER; v_donations INTEGER; v_dinners INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_teams FROM public.registrations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_sponsors FROM public.sponsors WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_donations FROM public.donations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_dinners FROM public.dinners WHERE paid = true;
  RETURN jsonb_build_object(
    'total_raised', v_teams * v_team_price + v_sponsors + v_donations + v_dinners,
    'teams_count', v_teams, 'sponsors_total', v_sponsors,
    'donations_total', v_donations, 'dinners_total', v_dinners);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_fundraising_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fundraising_total() TO authenticated;

-- ============ 5. next_year_interest ============
CREATE TABLE IF NOT EXISTS public.next_year_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  attended_prior_year BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'direct'
    CHECK (source IN ('post_event_email', 'direct', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS next_year_interest_email_lower_idx
  ON public.next_year_interest (lower(email));
ALTER TABLE public.next_year_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage next-year interest" ON public.next_year_interest;
CREATE POLICY "Admins can manage next-year interest"
  ON public.next_year_interest FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.add_next_year_interest(
  _email TEXT, _name TEXT DEFAULT NULL,
  _attended_prior_year BOOLEAN DEFAULT false, _source TEXT DEFAULT 'direct'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_clean_email TEXT; v_clean_name TEXT; v_clean_source TEXT;
BEGIN
  IF _email IS NULL OR btrim(_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_email');
  END IF;
  v_clean_email := lower(btrim(_email));
  IF position('@' IN v_clean_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;
  v_clean_name := NULLIF(btrim(COALESCE(_name, '')), '');
  v_clean_source := CASE WHEN _source IN ('post_event_email', 'direct', 'other') THEN _source ELSE 'direct' END;
  UPDATE public.next_year_interest
     SET name = COALESCE(v_clean_name, name),
         attended_prior_year = attended_prior_year OR COALESCE(_attended_prior_year, false)
   WHERE lower(email) = v_clean_email;
  IF NOT FOUND THEN
    INSERT INTO public.next_year_interest (email, name, attended_prior_year, source)
    VALUES (v_clean_email, v_clean_name, COALESCE(_attended_prior_year, false), v_clean_source);
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_next_year_interest(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_next_year_interest(TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;