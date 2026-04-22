-- Phase 2: silent auction bidders, bids, and the place_bid RPC.

-- 1. Bidders
CREATE TABLE public.auction_bidders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  display_name TEXT NOT NULL,
  stripe_customer_id TEXT,
  payment_method_id TEXT,  -- the saved card PaymentMethod attached to the customer
  session_token TEXT NOT NULL UNIQUE,
  phone_verified_at TIMESTAMPTZ,  -- reserved for future SMS OTP flow
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX auction_bidders_email_lower_idx ON public.auction_bidders (lower(email));
CREATE INDEX auction_bidders_session_token_idx ON public.auction_bidders (session_token);

ALTER TABLE public.auction_bidders ENABLE ROW LEVEL SECURITY;

-- Bidders are service_role only — frontend talks to them through RPCs and
-- edge functions, never via PostgREST directly.
CREATE POLICY "Admins can read bidders"
  ON public.auction_bidders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_auction_bidders_updated_at
  BEFORE UPDATE ON public.auction_bidders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Bids
CREATE TABLE public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.auction_items(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES public.auction_bidders(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auction_bids_item_created_idx ON public.auction_bids (item_id, created_at DESC);
CREATE INDEX auction_bids_item_amount_idx ON public.auction_bids (item_id, amount DESC);
CREATE INDEX auction_bids_bidder_idx ON public.auction_bids (bidder_id, created_at DESC);

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Public can read bids so the UI can show current high bid + bid history,
-- but we expose only the denormalized "display_name" via the view below —
-- the raw bidder_id is fine to expose as well (it's a UUID, no PII).
CREATE POLICY "Anyone can read bids"
  ON public.auction_bids FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bids"
  ON public.auction_bids FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime so browsers see new bids as they happen.
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;


-- 3. View for bidder display names alongside bids (avoids exposing emails/phones)
CREATE OR REPLACE VIEW public.auction_bid_display AS
SELECT
  b.id,
  b.item_id,
  b.bidder_id,
  b.amount,
  b.created_at,
  bd.display_name AS bidder_display_name
FROM public.auction_bids b
JOIN public.auction_bidders bd ON bd.id = b.bidder_id;

GRANT SELECT ON public.auction_bid_display TO anon, authenticated;


-- 4. place_bid RPC — validates session, inserts atomically, handles anti-snipe.
-- SECURITY DEFINER so anon callers can place bids via a session_token without
-- needing row-level access to the bidders table.
CREATE OR REPLACE FUNCTION public.place_bid(
  _session_token TEXT,
  _item_id UUID,
  _amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_bidder_id UUID;
  v_bidder_pm TEXT;
  v_item public.auction_items%ROWTYPE;
  v_settings public.auction_settings%ROWTYPE;
  v_current_high INTEGER;
  v_min_next INTEGER;
  v_increment INTEGER;
  v_now TIMESTAMPTZ := now();
  v_end_at TIMESTAMPTZ;
  v_anti_snipe_seconds INTEGER;
  v_extended BOOLEAN := false;
  v_bid_id UUID;
BEGIN
  IF _session_token IS NULL OR length(_session_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- Resolve bidder
  SELECT id, payment_method_id INTO v_bidder_id, v_bidder_pm
  FROM public.auction_bidders
  WHERE session_token = _session_token;

  IF v_bidder_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  IF v_bidder_pm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_method_missing');
  END IF;

  -- Load item + settings
  SELECT * INTO v_item FROM public.auction_items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_not_found');
  END IF;

  IF v_item.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'item_not_open');
  END IF;

  SELECT * INTO v_settings FROM public.auction_settings WHERE id = 1;

  IF NOT v_settings.is_live THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auction_not_live');
  END IF;

  IF v_settings.bidding_opens_at IS NOT NULL AND v_now < v_settings.bidding_opens_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bidding_not_open_yet');
  END IF;

  -- Item-level end_at overrides global
  v_end_at := COALESCE(v_item.ends_at, v_settings.bidding_closes_at);
  IF v_end_at IS NOT NULL AND v_now >= v_end_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bidding_closed');
  END IF;

  -- Work out min next bid
  v_increment := COALESCE(v_item.bid_increment, v_settings.default_bid_increment, 5);
  SELECT MAX(amount) INTO v_current_high FROM public.auction_bids WHERE item_id = _item_id;

  IF v_current_high IS NULL THEN
    v_min_next := v_item.starting_bid;
  ELSE
    v_min_next := v_current_high + v_increment;
  END IF;

  IF _amount < v_min_next THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'bid_too_low',
      'min_next', v_min_next,
      'current_high', v_current_high
    );
  END IF;

  -- Insert the bid
  INSERT INTO public.auction_bids (item_id, bidder_id, amount)
  VALUES (_item_id, v_bidder_id, _amount)
  RETURNING id INTO v_bid_id;

  -- Anti-snipe: if this bid landed within anti_snipe_seconds of close, extend.
  v_anti_snipe_seconds := COALESCE(v_settings.anti_snipe_seconds, 60);
  IF v_end_at IS NOT NULL
     AND v_anti_snipe_seconds > 0
     AND v_end_at - v_now < make_interval(secs => v_anti_snipe_seconds)
  THEN
    UPDATE public.auction_items
    SET ends_at = v_now + make_interval(secs => v_anti_snipe_seconds)
    WHERE id = _item_id;
    v_extended := true;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'bid_id', v_bid_id,
    'amount', _amount,
    'extended', v_extended,
    'new_ends_at', CASE WHEN v_extended THEN v_now + make_interval(secs => v_anti_snipe_seconds) ELSE v_end_at END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_bid(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(TEXT, UUID, INTEGER) TO anon, authenticated;


-- 5. Helper RPC so anon frontends can resolve "who am I" from session_token
-- without exposing the bidders table.
CREATE OR REPLACE FUNCTION public.get_bidder_by_session(_session_token TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  has_payment_method BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    b.id,
    b.email,
    b.phone,
    b.display_name,
    (b.payment_method_id IS NOT NULL) AS has_payment_method
  FROM public.auction_bidders b
  WHERE b.session_token = _session_token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bidder_by_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bidder_by_session(TEXT) TO anon, authenticated;


-- 6. Save the Stripe PaymentMethod id on the bidder after Payment Element confirms.
CREATE OR REPLACE FUNCTION public.attach_bidder_payment_method(
  _session_token TEXT,
  _payment_method_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _session_token IS NULL OR length(_session_token) < 16 OR _payment_method_id IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.auction_bidders
  SET payment_method_id = _payment_method_id
  WHERE session_token = _session_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT, TEXT) TO anon, authenticated;
