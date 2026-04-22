-- ============================================================================
-- PART 1: Phase 1 leftovers (tables already exist, finish bucket + triggers)
-- ============================================================================

-- Triggers for the existing auction_settings / auction_items tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_auction_settings_updated_at') THEN
    CREATE TRIGGER update_auction_settings_updated_at
      BEFORE UPDATE ON public.auction_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_auction_items_updated_at') THEN
    CREATE TRIGGER update_auction_items_updated_at
      BEFORE UPDATE ON public.auction_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS auction_items_sort_idx ON public.auction_items(sort_order);
CREATE INDEX IF NOT EXISTS auction_items_status_idx ON public.auction_items(status);

-- Storage bucket for auction item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction-items', 'auction-items', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Anyone can view auction images') THEN
    CREATE POLICY "Anyone can view auction images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'auction-items');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can upload auction images') THEN
    CREATE POLICY "Admins can upload auction images"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can update auction images') THEN
    CREATE POLICY "Admins can update auction images"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can delete auction images') THEN
    CREATE POLICY "Admins can delete auction images"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;


-- ============================================================================
-- PART 2: Phase 2 — bidders, bids, place_bid RPC
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auction_bidders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  display_name TEXT NOT NULL,
  stripe_customer_id TEXT,
  payment_method_id TEXT,
  session_token TEXT UNIQUE,
  phone_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auction_bidders_email_lower_idx ON public.auction_bidders (lower(email));
CREATE INDEX IF NOT EXISTS auction_bidders_session_token_idx ON public.auction_bidders (session_token);

ALTER TABLE public.auction_bidders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auction_bidders' AND policyname='Admins can read bidders') THEN
    CREATE POLICY "Admins can read bidders"
      ON public.auction_bidders FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_auction_bidders_updated_at') THEN
    CREATE TRIGGER update_auction_bidders_updated_at
      BEFORE UPDATE ON public.auction_bidders
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.auction_items(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.auction_bidders(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_bids_item_created_idx ON public.auction_bids (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auction_bids_item_amount_idx ON public.auction_bids (item_id, amount DESC);
CREATE INDEX IF NOT EXISTS auction_bids_bidder_idx ON public.auction_bids (bidder_id, created_at DESC);

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auction_bids' AND policyname='Anyone can read bids') THEN
    CREATE POLICY "Anyone can read bids" ON public.auction_bids FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auction_bids' AND policyname='Admins can manage bids') THEN
    CREATE POLICY "Admins can manage bids" ON public.auction_bids FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE VIEW public.auction_bid_display AS
SELECT b.id, b.item_id, b.bidder_id, b.amount, b.created_at, bd.display_name AS bidder_display_name
FROM public.auction_bids b JOIN public.auction_bidders bd ON bd.id = b.bidder_id;

GRANT SELECT ON public.auction_bid_display TO anon, authenticated;


-- ============================================================================
-- PART 3: Phase 3 — invoices and settlement RPCs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auction_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL UNIQUE REFERENCES public.auction_items(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.auction_bidders(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  tax_receipt_amount INTEGER NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'charged', 'requires_action', 'failed', 'refunded', 'manual')),
  error_message TEXT,
  payment_link_token TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_invoices_bidder_idx ON public.auction_invoices (bidder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auction_invoices_status_idx ON public.auction_invoices (status);
CREATE INDEX IF NOT EXISTS auction_invoices_payment_link_idx ON public.auction_invoices (payment_link_token);

ALTER TABLE public.auction_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auction_invoices' AND policyname='Admins can manage invoices') THEN
    CREATE POLICY "Admins can manage invoices" ON public.auction_invoices FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_auction_invoices_updated_at') THEN
    CREATE TRIGGER update_auction_invoices_updated_at
      BEFORE UPDATE ON public.auction_invoices
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lookup_auction_invoice_by_token(_token TEXT)
RETURNS TABLE (id UUID, item_id UUID, item_title TEXT, bidder_display_name TEXT, amount INTEGER, status TEXT, stripe_payment_intent_id TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT inv.id, inv.item_id, it.title, b.display_name, inv.amount, inv.status, inv.stripe_payment_intent_id
  FROM public.auction_invoices inv
  JOIN public.auction_items it ON it.id = inv.item_id
  JOIN public.auction_bidders b ON b.id = inv.bidder_id
  WHERE inv.payment_link_token = _token AND inv.status IN ('pending', 'requires_action', 'failed') LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_auction_invoice_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auction_invoice_by_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_auction_invoice_paid(_token TEXT, _payment_intent_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;
  UPDATE public.auction_invoices
  SET status='charged', paid_at=now(),
      stripe_payment_intent_id = COALESCE(_payment_intent_id, stripe_payment_intent_id),
      error_message = NULL
  WHERE payment_link_token = _token AND status IN ('pending','requires_action','failed');
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_already_paid'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_auction_invoice_paid(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_auction_invoice_paid(TEXT, TEXT) TO anon, authenticated;


-- ============================================================================
-- PART 4: Phase 3.5 — attending_event column + admin clear PM
-- ============================================================================
ALTER TABLE public.auction_bidders ADD COLUMN IF NOT EXISTS attending_event BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.admin_clear_bidder_payment_method(_bidder_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.auction_bidders SET payment_method_id = NULL WHERE id = _bidder_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_clear_bidder_payment_method(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_bidder_payment_method(UUID) TO authenticated;


-- ============================================================================
-- PART 5: Scorecard tournament
-- ============================================================================
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS score_token UUID NOT NULL DEFAULT gen_random_uuid();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registrations_score_token_unique') THEN
    ALTER TABLE public.registrations ADD CONSTRAINT registrations_score_token_unique UNIQUE (score_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS registrations_score_token_idx ON public.registrations(score_token);

CREATE TABLE IF NOT EXISTS public.scorecard_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL UNIQUE REFERENCES public.registrations(id) ON DELETE CASCADE,
  final_score INTEGER NOT NULL CHECK (final_score > 0 AND final_score < 300),
  photo_url TEXT NOT NULL,
  submitter_note TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scorecard_submissions_score_idx ON public.scorecard_submissions(final_score);
CREATE INDEX IF NOT EXISTS scorecard_submissions_verified_idx ON public.scorecard_submissions(verified, disqualified);

ALTER TABLE public.scorecard_submissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scorecard_submissions' AND policyname='Admins can manage scorecards') THEN
    CREATE POLICY "Admins can manage scorecards" ON public.scorecard_submissions FOR ALL
      USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_scorecard_submissions_updated_at') THEN
    CREATE TRIGGER update_scorecard_submissions_updated_at
      BEFORE UPDATE ON public.scorecard_submissions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public) VALUES ('scorecard-photos', 'scorecard-photos', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Anyone can view scorecard photos') THEN
    CREATE POLICY "Anyone can view scorecard photos" ON storage.objects FOR SELECT USING (bucket_id = 'scorecard-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can manage scorecard photos') THEN
    CREATE POLICY "Admins can manage scorecard photos" ON storage.objects FOR ALL
      USING (bucket_id = 'scorecard-photos' AND has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'scorecard-photos' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.lookup_team_by_score_token(_token UUID)
RETURNS TABLE (registration_id UUID, team_name TEXT, business_name TEXT, already_submitted BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.team_name, r.business_name,
    EXISTS (SELECT 1 FROM public.scorecard_submissions s WHERE s.registration_id = r.id) AS already_submitted
  FROM public.registrations r WHERE r.score_token = _token AND r.paid = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.lookup_team_by_score_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_team_by_score_token(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (registration_id UUID, team_name TEXT, business_name TEXT, final_score INTEGER, photo_url TEXT, submitted_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.team_name, r.business_name, s.final_score, s.photo_url, s.created_at
  FROM public.scorecard_submissions s JOIN public.registrations r ON r.id = s.registration_id
  WHERE s.verified = true AND s.disqualified = false
  ORDER BY s.final_score ASC, s.created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_scorecard(_token UUID, _final_score INTEGER, _photo_url TEXT, _submitter_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_registration_id UUID;
BEGIN
  IF _token IS NULL OR _final_score IS NULL OR _photo_url IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_fields'); END IF;
  IF _final_score <= 0 OR _final_score >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_score'); END IF;
  SELECT id INTO v_registration_id FROM public.registrations WHERE score_token = _token AND paid = true;
  IF v_registration_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_token'); END IF;
  INSERT INTO public.scorecard_submissions (registration_id, final_score, photo_url, submitter_note)
  VALUES (v_registration_id, _final_score, _photo_url, _submitter_note)
  ON CONFLICT (registration_id) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'already_submitted'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_scorecard(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_scorecard(UUID, INTEGER, TEXT, TEXT) TO anon, authenticated;


-- ============================================================================
-- PART 6: Auction auth overhaul — switch to Supabase Auth
-- ============================================================================
ALTER TABLE public.auction_bidders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.auction_bidders ALTER COLUMN session_token DROP NOT NULL;

CREATE INDEX IF NOT EXISTS auction_bidders_auth_user_idx ON public.auction_bidders (auth_user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='auction_bidders' AND policyname='Bidders can read their own row') THEN
    CREATE POLICY "Bidders can read their own row" ON public.auction_bidders FOR SELECT USING (auth_user_id = auth.uid());
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_bidder_by_session(TEXT);
DROP FUNCTION IF EXISTS public.place_bid(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.attach_bidder_payment_method(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_bidder_attending(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.my_auction_invoices(TEXT);

CREATE OR REPLACE FUNCTION public.place_bid(_item_id UUID, _amount INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_bidder_id UUID; v_bidder_pm TEXT;
  v_item public.auction_items%ROWTYPE; v_settings public.auction_settings%ROWTYPE;
  v_current_high INTEGER; v_min_next INTEGER; v_increment INTEGER;
  v_now TIMESTAMPTZ := now(); v_end_at TIMESTAMPTZ;
  v_anti_snipe_seconds INTEGER; v_extended BOOLEAN := false; v_bid_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT id, payment_method_id INTO v_bidder_id, v_bidder_pm FROM public.auction_bidders WHERE auth_user_id = auth.uid();
  IF v_bidder_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'profile_not_set_up'); END IF;
  IF v_bidder_pm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'payment_method_missing'); END IF;
  SELECT * INTO v_item FROM public.auction_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'item_not_found'); END IF;
  IF v_item.status <> 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'item_not_open'); END IF;
  SELECT * INTO v_settings FROM public.auction_settings WHERE id = 1;
  IF NOT v_settings.is_live THEN RETURN jsonb_build_object('ok', false, 'error', 'auction_not_live'); END IF;
  IF v_settings.bidding_opens_at IS NOT NULL AND v_now < v_settings.bidding_opens_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bidding_not_open_yet'); END IF;
  v_end_at := COALESCE(v_item.ends_at, v_settings.bidding_closes_at);
  IF v_end_at IS NOT NULL AND v_now >= v_end_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bidding_closed'); END IF;
  v_increment := COALESCE(v_item.bid_increment, v_settings.default_bid_increment, 5);
  SELECT MAX(amount) INTO v_current_high FROM public.auction_bids WHERE item_id = _item_id;
  IF v_current_high IS NULL THEN v_min_next := v_item.starting_bid;
  ELSE v_min_next := v_current_high + v_increment; END IF;
  IF _amount < v_min_next THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bid_too_low', 'min_next', v_min_next, 'current_high', v_current_high); END IF;
  INSERT INTO public.auction_bids (item_id, bidder_id, amount) VALUES (_item_id, v_bidder_id, _amount) RETURNING id INTO v_bid_id;
  v_anti_snipe_seconds := COALESCE(v_settings.anti_snipe_seconds, 60);
  IF v_end_at IS NOT NULL AND v_anti_snipe_seconds > 0 AND v_end_at - v_now < make_interval(secs => v_anti_snipe_seconds) THEN
    UPDATE public.auction_items SET ends_at = v_now + make_interval(secs => v_anti_snipe_seconds) WHERE id = _item_id;
    v_extended := true;
  END IF;
  RETURN jsonb_build_object('ok', true, 'bid_id', v_bid_id, 'amount', _amount, 'extended', v_extended,
    'new_ends_at', CASE WHEN v_extended THEN v_now + make_interval(secs => v_anti_snipe_seconds) ELSE v_end_at END);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_bid(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_bidder_payment_method(_payment_method_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR _payment_method_id IS NULL THEN RETURN false; END IF;
  UPDATE public.auction_bidders SET payment_method_id = _payment_method_id WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_bidder_attending(_attending BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  UPDATE public.auction_bidders SET attending_event = COALESCE(_attending, false) WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_bidder_attending(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bidder_attending(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_auction_invoices()
RETURNS TABLE (id UUID, item_id UUID, item_title TEXT, amount INTEGER, status TEXT, payment_link_token TEXT, paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT inv.id, inv.item_id, it.title, inv.amount, inv.status, inv.payment_link_token, inv.paid_at, inv.created_at
  FROM public.auction_invoices inv
  JOIN public.auction_items it ON it.id = inv.item_id
  JOIN public.auction_bidders b ON b.id = inv.bidder_id
  WHERE b.auth_user_id = auth.uid()
  ORDER BY inv.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.my_auction_invoices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_auction_invoices() TO authenticated;


-- ============================================================================
-- PART 7: Outbid SMS preferences
-- ============================================================================
ALTER TABLE public.auction_bidders ADD COLUMN IF NOT EXISTS notify_outbid_sms BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_my_bidder_profile()
RETURNS TABLE (id UUID, email TEXT, phone TEXT, display_name TEXT, has_payment_method BOOLEAN, attending_event BOOLEAN, notify_outbid_sms BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, b.email, b.phone, b.display_name,
    (b.payment_method_id IS NOT NULL),
    COALESCE(b.attending_event, false),
    COALESCE(b.notify_outbid_sms, true)
  FROM public.auction_bidders b WHERE b.auth_user_id = auth.uid() LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_bidder_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_bidder_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_bidder_notify_outbid(_enabled BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  UPDATE public.auction_bidders SET notify_outbid_sms = COALESCE(_enabled, true) WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_bidder_notify_outbid(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bidder_notify_outbid(BOOLEAN) TO authenticated;


-- ============================================================================
-- PART 8: Team features
-- ============================================================================
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS team_members JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS team_photo_url TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS team_slug TEXT;

UPDATE public.registrations
SET team_slug = regexp_replace(lower(coalesce(team_name, 'team')), '[^a-z0-9]+', '-', 'g') || '-' || substring(id::text, 1, 4)
WHERE team_slug IS NULL;

ALTER TABLE public.registrations ALTER COLUMN team_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_team_slug_unique ON public.registrations(team_slug);

INSERT INTO storage.buckets (id, name, public) VALUES ('team-photos', 'team-photos', true) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Anyone can view team photos') THEN
    CREATE POLICY "Anyone can view team photos" ON storage.objects FOR SELECT USING (bucket_id = 'team-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can manage team photos') THEN
    CREATE POLICY "Admins can manage team photos" ON storage.objects FOR ALL
      USING (bucket_id = 'team-photos' AND has_role(auth.uid(), 'admin'::app_role))
      WITH CHECK (bucket_id = 'team-photos' AND has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS donations_team_id_idx ON public.donations(team_id);

CREATE OR REPLACE FUNCTION public.get_team_for_management(_token UUID)
RETURNS TABLE (registration_id UUID, team_name TEXT, business_name TEXT, team_slug TEXT, team_members JSONB, team_photo_url TEXT, captain_name TEXT, captain_email TEXT, team_fundraising_total INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.team_name, r.business_name, r.team_slug, r.team_members, r.team_photo_url, r.captain_name, r.captain_email,
    COALESCE((SELECT SUM(d.amount)::INTEGER FROM public.donations d WHERE d.team_id = r.id AND d.paid = true), 0)
  FROM public.registrations r WHERE r.score_token = _token AND r.paid = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_for_management(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_for_management(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_public(_slug TEXT)
RETURNS TABLE (registration_id UUID, team_name TEXT, business_name TEXT, team_slug TEXT, team_photo_url TEXT, member_first_names TEXT[], team_fundraising_total INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.team_name, r.business_name, r.team_slug, r.team_photo_url,
    ARRAY(SELECT split_part(coalesce(m->>'name', ''), ' ', 1) FROM jsonb_array_elements(r.team_members) m WHERE coalesce(m->>'name', '') <> ''),
    COALESCE((SELECT SUM(d.amount)::INTEGER FROM public.donations d WHERE d.team_id = r.id AND d.paid = true), 0)
  FROM public.registrations r WHERE r.team_slug = _slug AND r.paid = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_public(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_team_details(_token UUID, _team_members JSONB, _team_photo_url TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_updated INTEGER;
BEGIN
  IF _token IS NULL THEN RETURN false; END IF;
  UPDATE public.registrations
  SET team_members = COALESCE(_team_members, team_members),
      team_photo_url = COALESCE(_team_photo_url, team_photo_url)
  WHERE score_token = _token AND paid = true;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_team_id_by_slug(_slug TEXT)
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id FROM public.registrations WHERE team_slug = _slug AND paid = true LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_team_id_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_id_by_slug(TEXT) TO anon, authenticated, service_role;