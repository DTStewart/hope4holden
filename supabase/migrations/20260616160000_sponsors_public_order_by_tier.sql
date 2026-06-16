-- Order the public homepage sponsor grid by tier hierarchy.
--
-- The sponsors_public view had no ORDER BY, so the homepage grid (Index.tsx,
-- which adds no .order()) rendered in arbitrary Postgres order. Recreate the view
-- with a LEFT JOIN to sponsorship_tiers so it can sort by tier rank, then by
-- amount, then alphabetically.
--
-- CREATE OR REPLACE VIEW is sufficient (and preferred): the projected column set
-- is unchanged (same names, order, and types), which is all Postgres requires for
-- a replace -- adding a JOIN and ORDER BY to the underlying query is allowed. No
-- DROP is needed, so the existing anon/authenticated SELECT grants persist; the
-- GRANTs below are re-stated defensively and are idempotent.
--
-- LEFT JOIN (not INNER) so a sponsor with a null/unmatched tier_id still appears
-- and sorts last (NULLS LAST) rather than vanishing. tier_id/amount are NOT added
-- to the projection -- ORDER BY may reference table columns that aren't selected --
-- so Index.tsx's select("id, business_name, tier_name, logo_url") is untouched.
-- Columns are qualified with sponsors.* because id exists on both joined tables.
CREATE OR REPLACE VIEW public.sponsors_public
WITH (security_invoker = true) AS
SELECT sponsors.id,
       sponsors.business_name,
       sponsors.tier_name,
       sponsors.tier_id,
       sponsors.logo_url,
       sponsors.approved,
       sponsors.brand_assets
FROM public.sponsors
LEFT JOIN public.sponsorship_tiers t ON t.id = sponsors.tier_id
WHERE sponsors.approved = true AND sponsors.paid = true
ORDER BY t.sort_order ASC NULLS LAST,
         sponsors.amount DESC NULLS LAST,
         sponsors.business_name ASC;

GRANT SELECT ON public.sponsors_public TO anon, authenticated;
