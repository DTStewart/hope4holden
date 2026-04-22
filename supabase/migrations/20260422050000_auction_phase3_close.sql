-- Phase 3: auction close + off-session settlement.

-- 1. Invoices: one row per closed item's winner.
CREATE TABLE public.auction_invoices (
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
  notified_at TIMESTAMPTZ,  -- last time we emailed the winner
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auction_invoices_bidder_idx ON public.auction_invoices (bidder_id, created_at DESC);
CREATE INDEX auction_invoices_status_idx ON public.auction_invoices (status);
CREATE INDEX auction_invoices_payment_link_idx ON public.auction_invoices (payment_link_token);

ALTER TABLE public.auction_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read invoices"
  ON public.auction_invoices FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage invoices"
  ON public.auction_invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_auction_invoices_updated_at
  BEFORE UPDATE ON public.auction_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Lookup RPC for the public payment-fallback page (anon-callable).
-- Returns just enough info to render the re-auth page, plus the invoice id
-- so the caller can confirm payment. Only returns invoices whose status
-- means payment hasn't succeeded yet.
CREATE OR REPLACE FUNCTION public.lookup_auction_invoice_by_token(_token TEXT)
RETURNS TABLE (
  id UUID,
  item_id UUID,
  item_title TEXT,
  bidder_display_name TEXT,
  amount INTEGER,
  status TEXT,
  stripe_payment_intent_id TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    inv.id,
    inv.item_id,
    it.title AS item_title,
    b.display_name AS bidder_display_name,
    inv.amount,
    inv.status,
    inv.stripe_payment_intent_id
  FROM public.auction_invoices inv
  JOIN public.auction_items it ON it.id = inv.item_id
  JOIN public.auction_bidders b ON b.id = inv.bidder_id
  WHERE inv.payment_link_token = _token
    AND inv.status IN ('pending', 'requires_action', 'failed')
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_auction_invoice_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_auction_invoice_by_token(TEXT) TO anon, authenticated;


-- 3. Mark-paid RPC — called by the fallback page after the client-side
-- PaymentIntent confirmation succeeds. Moves the invoice to 'charged'.
-- Re-checks status via token so only someone with the token can transition.
CREATE OR REPLACE FUNCTION public.mark_auction_invoice_paid(
  _token TEXT,
  _payment_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.auction_invoices
  SET
    status = 'charged',
    paid_at = now(),
    stripe_payment_intent_id = COALESCE(_payment_intent_id, stripe_payment_intent_id),
    error_message = NULL
  WHERE payment_link_token = _token
    AND status IN ('pending', 'requires_action', 'failed');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found_or_already_paid');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_auction_invoice_paid(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_auction_invoice_paid(TEXT, TEXT) TO anon, authenticated;


-- 4. "My wins" RPC — lets a bidder see their invoices using just their session token.
CREATE OR REPLACE FUNCTION public.my_auction_invoices(_session_token TEXT)
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
  WHERE b.session_token = _session_token
  ORDER BY inv.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.my_auction_invoices(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_auction_invoices(TEXT) TO anon, authenticated;
