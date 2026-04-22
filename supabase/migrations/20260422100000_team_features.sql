-- Team features:
-- - Rosters + dietary restrictions (for catering)
-- - Team photos (for leaderboard + public team page)
-- - Team donation pages with per-team fundraising attribution

-- 1. Add team-related columns to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_members JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_photo_url TEXT;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_slug TEXT;

-- Generate a URL-safe slug from team_name for existing rows, with id suffix
-- for uniqueness. Example: "pendleton-insurance-a7f4".
UPDATE public.registrations
SET team_slug = regexp_replace(
                  lower(coalesce(team_name, 'team')),
                  '[^a-z0-9]+', '-', 'g'
                ) || '-' || substring(id::text, 1, 4)
WHERE team_slug IS NULL;

ALTER TABLE public.registrations
  ALTER COLUMN team_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_team_slug_unique
  ON public.registrations(team_slug);


-- 2. Storage bucket for team photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view team photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-photos');

CREATE POLICY "Admins can manage team photos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'team-photos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'team-photos' AND has_role(auth.uid(), 'admin'::app_role));


-- 3. Donation attribution: link a donation to a team (optional)
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS donations_team_id_idx ON public.donations(team_id);


-- 4. RPCs

-- Team lookup for the captain's management page (keyed by score_token —
-- the same token they use for scorecard submission).
CREATE OR REPLACE FUNCTION public.get_team_for_management(_token UUID)
RETURNS TABLE (
  registration_id UUID,
  team_name TEXT,
  business_name TEXT,
  team_slug TEXT,
  team_members JSONB,
  team_photo_url TEXT,
  captain_name TEXT,
  captain_email TEXT,
  team_fundraising_total INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    r.team_name,
    r.business_name,
    r.team_slug,
    r.team_members,
    r.team_photo_url,
    r.captain_name,
    r.captain_email,
    COALESCE((
      SELECT SUM(d.amount)::INTEGER
      FROM public.donations d
      WHERE d.team_id = r.id AND d.paid = true
    ), 0) AS team_fundraising_total
  FROM public.registrations r
  WHERE r.score_token = _token AND r.paid = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_for_management(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_for_management(UUID) TO anon, authenticated;


-- Public team page — accessible by slug, exposes only safe info.
CREATE OR REPLACE FUNCTION public.get_team_public(_slug TEXT)
RETURNS TABLE (
  registration_id UUID,
  team_name TEXT,
  business_name TEXT,
  team_slug TEXT,
  team_photo_url TEXT,
  member_first_names TEXT[],
  team_fundraising_total INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id,
    r.team_name,
    r.business_name,
    r.team_slug,
    r.team_photo_url,
    -- Expose only first names of team members (privacy): everything before first space.
    ARRAY(
      SELECT split_part(coalesce(m->>'name', ''), ' ', 1)
      FROM jsonb_array_elements(r.team_members) m
      WHERE coalesce(m->>'name', '') <> ''
    ) AS member_first_names,
    COALESCE((
      SELECT SUM(d.amount)::INTEGER
      FROM public.donations d
      WHERE d.team_id = r.id AND d.paid = true
    ), 0) AS team_fundraising_total
  FROM public.registrations r
  WHERE r.team_slug = _slug AND r.paid = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_public(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_public(TEXT) TO anon, authenticated;


-- Captain updates their team. Accepts score_token, rewrites members/photo.
CREATE OR REPLACE FUNCTION public.update_team_details(
  _token UUID,
  _team_members JSONB,
  _team_photo_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF _token IS NULL THEN RETURN false; END IF;

  UPDATE public.registrations
  SET
    team_members = COALESCE(_team_members, team_members),
    team_photo_url = COALESCE(_team_photo_url, team_photo_url)
  WHERE score_token = _token AND paid = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT) TO anon, authenticated;


-- Slug → id lookup for the checkout flow (webhook uses this to attribute donations).
CREATE OR REPLACE FUNCTION public.get_team_id_by_slug(_slug TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.registrations
  WHERE team_slug = _slug AND paid = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_id_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_id_by_slug(TEXT) TO anon, authenticated, service_role;
