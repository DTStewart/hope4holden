-- 1. Create a public view for sponsors that hides sensitive fields
CREATE VIEW public.sponsors_public
WITH (security_invoker = on) AS
  SELECT id, business_name, tier_name, tier_id, logo_url, approved, brand_assets
  FROM public.sponsors
  WHERE approved = true;

-- 2. Replace the overly permissive SELECT policy on the base sponsors table
-- Keep admin full access, remove public access to base table
DROP POLICY IF EXISTS "Anyone can view approved sponsors" ON public.sponsors;

CREATE POLICY "Only admins can select sponsors"
  ON public.sponsors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Drop the open storage upload policy if it exists
-- (The edge function uses service_role which bypasses RLS)
DROP POLICY IF EXISTS "Anyone can upload sponsor logos" ON storage.objects;