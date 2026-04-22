-- Migrate bidders from custom session_token auth to Supabase Auth (OAuth).
-- auth_user_id becomes the new identity; session_token is kept nullable for
-- legacy grace-period (no production bidders yet but this is safer).

ALTER TABLE public.auction_bidders
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- session_token no longer required — new bidders are identified via auth_user_id.
ALTER TABLE public.auction_bidders ALTER COLUMN session_token DROP NOT NULL;

CREATE INDEX IF NOT EXISTS auction_bidders_auth_user_idx ON public.auction_bidders (auth_user_id);

-- Row-level: let each bidder read their own row via auth.uid().
CREATE POLICY "Bidders can read their own row"
  ON public.auction_bidders FOR SELECT
  USING (auth_user_id = auth.uid());


-- Drop the old session_token-based RPCs — replaced below with auth.uid() versions.
DROP FUNCTION IF EXISTS public.get_bidder_by_session(TEXT);
DROP FUNCTION IF EXISTS public.place_bid(TEXT, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.attach_bidder_payment_method(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_bidder_attending(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.my_auction_invoices(TEXT);


-- ============================================================================
-- Current-user profile lookup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_bidder_profile()
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  has_payment_method BOOLEAN,
  attending_event BOOLEAN
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
    (b.payment_method_id IS NOT NULL) AS has_payment_method,
    COALESCE(b.attending_event, false) AS attending_event
  FROM public.auction_bidders b
  WHERE b.auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_bidder_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_bidder_profile() TO authenticated;


-- ============================================================================
-- Place bid (now auth.uid() based, no session_token)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.place_bid(_item_id UUID, _amount INTEGER)
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
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;

  SELECT id, payment_method_id INTO v_bidder_id, v_bidder_pm
  FROM public.auction_bidders
  WHERE auth_user_id = auth.uid();

  IF v_bidder_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'profile_not_set_up');
  END IF;

  IF v_bidder_pm IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_method_missing');
  END IF;

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

  v_end_at := COALESCE(v_item.ends_at, v_settings.bidding_closes_at);
  IF v_end_at IS NOT NULL AND v_now >= v_end_at THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bidding_closed');
  END IF;

  v_increment := COALESCE(v_item.bid_increment, v_settings.default_bid_increment, 5);
  SELECT MAX(amount) INTO v_current_high FROM public.auction_bids WHERE item_id = _item_id;

  IF v_current_high IS NULL THEN
    v_min_next := v_item.starting_bid;
  ELSE
    v_min_next := v_current_high + v_increment;
  END IF;

  IF _amount < v_min_next THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'bid_too_low',
      'min_next', v_min_next, 'current_high', v_current_high
    );
  END IF;

  INSERT INTO public.auction_bids (item_id, bidder_id, amount)
  VALUES (_item_id, v_bidder_id, _amount)
  RETURNING id INTO v_bid_id;

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

REVOKE EXECUTE ON FUNCTION public.place_bid(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bid(UUID, INTEGER) TO authenticated;


-- ============================================================================
-- Attach Stripe PaymentMethod to the signed-in bidder.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.attach_bidder_payment_method(_payment_method_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL OR _payment_method_id IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.auction_bidders
  SET payment_method_id = _payment_method_id
  WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_bidder_payment_method(TEXT) TO authenticated;


-- ============================================================================
-- Update attendance flag.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_bidder_attending(_attending BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.auction_bidders
  SET attending_event = COALESCE(_attending, false)
  WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_bidder_attending(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bidder_attending(BOOLEAN) TO authenticated;


-- ============================================================================
-- My invoices — the /auction/my-wins page calls this.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.my_auction_invoices()
RETURNS TABLE (
  id UUID,
  item_id UUID,
  item_title TEXT,
  amount INTEGER,
  status TEXT,
  payment_link_token TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    inv.id,
    inv.item_id,
    it.title AS item_title,
    inv.amount,
    inv.status,
    inv.payment_link_token,
    inv.paid_at,
    inv.created_at
  FROM public.auction_invoices inv
  JOIN public.auction_items it ON it.id = inv.item_id
  JOIN public.auction_bidders b ON b.id = inv.bidder_id
  WHERE b.auth_user_id = auth.uid()
  ORDER BY inv.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.my_auction_invoices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_auction_invoices() TO authenticated;
