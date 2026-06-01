-- Security fix: close the anon/authenticated path to mark_auction_invoice_paid.
--
-- mark_auction_invoice_paid (defined in 20260422050000_auction_phase3_close.sql)
-- moves an invoice to charged/paid_at using only the payment_link_token, with no
-- Stripe verification. It was granted to anon and authenticated, so anyone
-- holding a fallback link could mark their own invoice paid without paying.
--
-- Payment verification now lives in the auction-verify-fallback-payment edge
-- function, which retrieves the PaymentIntent server-side and confirms its
-- status, amount, currency, and metadata.invoice_id before recording payment.
-- That function performs the invoice update itself under service_role, so the
-- RPC no longer needs to be reachable from the client.
--
-- The function is intentionally kept (not dropped) for possible service-role /
-- admin use; this migration only removes the client-facing grants. PUBLIC was
-- already revoked when the function was created, so revoking anon and
-- authenticated leaves no client-callable path.

REVOKE EXECUTE ON FUNCTION public.mark_auction_invoice_paid(TEXT, TEXT) FROM anon, authenticated;
