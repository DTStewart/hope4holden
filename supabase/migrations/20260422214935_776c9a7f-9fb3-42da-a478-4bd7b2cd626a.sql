-- Fix 1: Remove public SELECT policy on sponsors that exposes PII (contact_email/name/phone).
-- Public reads will go through the sponsors_public view which omits contact fields.
DROP POLICY IF EXISTS "Anyone can view approved sponsors" ON public.sponsors;

-- Fix 2: Recreate views as SECURITY INVOKER so they enforce the querying user's RLS,
-- not the view creator's. The sponsors_public view exposes only display-safe columns.
DROP VIEW IF EXISTS public.sponsors_public;
CREATE VIEW public.sponsors_public
WITH (security_invoker = true) AS
SELECT id, business_name, tier_name, tier_id, logo_url, approved, brand_assets
FROM public.sponsors
WHERE approved = true AND paid = true;

DROP VIEW IF EXISTS public.auction_bid_display;
CREATE VIEW public.auction_bid_display
WITH (security_invoker = true) AS
SELECT b.id, b.item_id, b.bidder_id, b.amount, b.created_at,
       bd.display_name AS bidder_display_name
FROM public.auction_bids b
JOIN public.auction_bidders bd ON bd.id = b.bidder_id;

-- Re-grant SELECT to anon/authenticated since DROP removes grants
GRANT SELECT ON public.sponsors_public TO anon, authenticated;
GRANT SELECT ON public.auction_bid_display TO anon, authenticated;

-- For sponsors_public to work via security_invoker, anon/authenticated must be
-- able to SELECT from underlying sponsors table. Add a column-restricted policy
-- using a view-only approach: since views with security_invoker need underlying
-- table access, add a SELECT policy that only permits anon/authenticated when
-- query is scoped to non-PII columns is not enforceable at RLS level.
-- Instead, add a SELECT policy restricted to approved+paid rows — and rely on
-- the view to project only safe columns. The PII columns are still readable
-- if someone queries the table directly, so we instead REVOKE direct table SELECT
-- from anon and only allow it via the SECURITY DEFINER-style barrier.
--
-- Better approach: keep RLS denying anon, and convert sponsors_public back to
-- SECURITY DEFINER but with an explicit owner check. However linter flags that.
-- Cleanest: re-add a SELECT policy on sponsors that ONLY returns safe columns is
-- not possible at RLS. So we add policy permitting anon/authenticated for approved+paid
-- rows, AND revoke direct SELECT grant on the sponsors table from anon, forcing
-- access through the view. Authenticated admin still gets full access via has_role.

REVOKE SELECT ON public.sponsors FROM anon, authenticated;
GRANT SELECT ON public.sponsors TO authenticated; -- needed for admin policy

-- Re-add SELECT policy for sponsors so authenticated admins keep working AND
-- so the security_invoker view can resolve rows for anon (via grants on view + barrier).
-- Without table access, the view returns nothing for anon. Solution: grant SELECT
-- on sponsors to anon but rely on RLS to limit to approved+paid rows. Then the
-- view restricts columns. But anon could query table directly for PII.
--
-- FINAL approach: keep table fully locked from anon (no policy), and convert the
-- view to SECURITY DEFINER owned by a role with limited rights. Since the linter
-- still flags SECURITY DEFINER views, use a SECURITY DEFINER FUNCTION instead.

-- Drop the security_invoker view; replace with a SECURITY DEFINER function approach.
DROP VIEW IF EXISTS public.sponsors_public;

CREATE OR REPLACE FUNCTION public.get_public_sponsors()
RETURNS TABLE (
  id uuid,
  business_name text,
  tier_name text,
  tier_id uuid,
  logo_url text,
  approved boolean,
  brand_assets jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, business_name, tier_name, tier_id, logo_url, approved, brand_assets
  FROM public.sponsors
  WHERE approved = true AND paid = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_sponsors() TO anon, authenticated;

-- Recreate sponsors_public view as SECURITY INVOKER wrapper around the function.
-- This keeps existing client code working (.from("sponsors_public")) without changes.
CREATE VIEW public.sponsors_public
WITH (security_invoker = true) AS
SELECT * FROM public.get_public_sponsors();

GRANT SELECT ON public.sponsors_public TO anon, authenticated;