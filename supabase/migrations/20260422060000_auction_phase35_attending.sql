-- Phase 3.5: track whether a bidder is attending the tournament dinner,
-- and give admins a way to clear a bidder's saved card for support cases.

ALTER TABLE public.auction_bidders
  ADD COLUMN IF NOT EXISTS attending_event BOOLEAN NOT NULL DEFAULT false;

-- Admin RPC: clear a bidder's payment method on file. Leaves the Stripe
-- Customer intact (so Stripe history is preserved) but forces the bidder to
-- add a new card via the "Change payment method" flow before they can bid again.
CREATE OR REPLACE FUNCTION public.admin_clear_bidder_payment_method(_bidder_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin_uuid UUID := auth.uid();
BEGIN
  IF v_admin_uuid IS NULL OR NOT has_role(v_admin_uuid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.auction_bidders
  SET payment_method_id = NULL
  WHERE id = _bidder_id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_clear_bidder_payment_method(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_bidder_payment_method(UUID) TO authenticated;


-- Replace get_bidder_by_session to also expose attending_event so the public
-- UI can tailor copy and warnings.
CREATE OR REPLACE FUNCTION public.get_bidder_by_session(_session_token TEXT)
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
  WHERE b.session_token = _session_token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bidder_by_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bidder_by_session(TEXT) TO anon, authenticated;


-- Allow bidders to update their own attending_event flag via session token.
CREATE OR REPLACE FUNCTION public.update_bidder_attending(_session_token TEXT, _attending BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _session_token IS NULL OR length(_session_token) < 16 THEN
    RETURN false;
  END IF;
  UPDATE public.auction_bidders
  SET attending_event = COALESCE(_attending, false)
  WHERE session_token = _session_token;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_bidder_attending(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bidder_attending(TEXT, BOOLEAN) TO anon, authenticated;
