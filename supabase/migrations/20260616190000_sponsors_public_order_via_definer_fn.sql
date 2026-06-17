-- Fix the public sponsor grid broken by 20260616160000 (4fdf475).
--
-- 4fdf475 rewrote sponsors_public to read public.sponsors directly under
-- security_invoker, but anon is REVOKEd from public.sponsors (PII barrier set in
-- 20260422214935), so the public grid 401'd ("permission denied for table
-- sponsors") and rendered empty.
--
-- Restore the original barrier: the SECURITY DEFINER function get_public_sponsors()
-- reads sponsors as its owner (bypassing the anon revoke) and projects only
-- display-safe columns; sponsors_public is a security_invoker view that just
-- selects from the function (anon needs only EXECUTE on it). The tier-rank
-- ordering that 4fdf475 wanted now lives INSIDE the function, where the join to
-- sponsorship_tiers is legal.
--
-- The function's RETURNS TABLE shape is preserved exactly (id, business_name,
-- tier_name, tier_id, logo_url, approved, brand_assets) so the view and Index.tsx
-- are untouched. We do NOT alter any grant or policy on public.sponsors; the
-- anon REVOKE stays. Columns are qualified with sponsors.* because id exists on
-- both joined tables; the ORDER BY references t.sort_order without selecting it.
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
  SELECT sponsors.id, sponsors.business_name, sponsors.tier_name, sponsors.tier_id,
         sponsors.logo_url, sponsors.approved, sponsors.brand_assets
  FROM public.sponsors
  LEFT JOIN public.sponsorship_tiers t ON t.id = sponsors.tier_id
  WHERE sponsors.approved = true AND sponsors.paid = true
  ORDER BY t.sort_order ASC NULLS LAST,
           sponsors.amount DESC NULLS LAST,
           sponsors.business_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_sponsors() TO anon, authenticated;

-- Point the view back at the function (reverting 4fdf475's direct base-table read).
-- Same output column set, so CREATE OR REPLACE is sufficient; grant re-stated.
CREATE OR REPLACE VIEW public.sponsors_public
WITH (security_invoker = true) AS
SELECT * FROM public.get_public_sponsors();

GRANT SELECT ON public.sponsors_public TO anon, authenticated;
