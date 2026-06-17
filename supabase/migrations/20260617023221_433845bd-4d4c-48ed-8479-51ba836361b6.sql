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

CREATE OR REPLACE VIEW public.sponsors_public
WITH (security_invoker = true) AS
SELECT * FROM public.get_public_sponsors();

GRANT SELECT ON public.sponsors_public TO anon, authenticated;