-- Outbid notification preferences.
-- notify_outbid_sms: controls whether the auction-send-outbid-sms function
-- actually dispatches a text when this bidder is outbid. In-app realtime
-- toasts are always shown (they cost nothing; only visible when the bidder
-- is actively on /auction anyway).

ALTER TABLE public.auction_bidders
  ADD COLUMN IF NOT EXISTS notify_outbid_sms BOOLEAN NOT NULL DEFAULT true;


-- Re-create get_my_bidder_profile to also return the new preference.
CREATE OR REPLACE FUNCTION public.get_my_bidder_profile()
RETURNS TABLE (
  id UUID,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  has_payment_method BOOLEAN,
  attending_event BOOLEAN,
  notify_outbid_sms BOOLEAN
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
    COALESCE(b.attending_event, false) AS attending_event,
    COALESCE(b.notify_outbid_sms, true) AS notify_outbid_sms
  FROM public.auction_bidders b
  WHERE b.auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_bidder_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_bidder_profile() TO authenticated;


-- Toggle outbid SMS preference
CREATE OR REPLACE FUNCTION public.update_bidder_notify_outbid(_enabled BOOLEAN)
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
  SET notify_outbid_sms = COALESCE(_enabled, true)
  WHERE auth_user_id = auth.uid();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_bidder_notify_outbid(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_bidder_notify_outbid(BOOLEAN) TO authenticated;
