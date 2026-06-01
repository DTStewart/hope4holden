DROP FUNCTION IF EXISTS public.get_team_for_management(UUID);

CREATE FUNCTION public.get_team_for_management(_token UUID)
RETURNS TABLE (
  registration_id UUID,
  team_name TEXT,
  business_name TEXT,
  team_slug TEXT,
  team_members JSONB,
  team_photo_url TEXT,
  captain_name TEXT,
  captain_email TEXT,
  captain_phone TEXT,
  golfer_count INTEGER,
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
    r.captain_phone,
    r.golfer_count,
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

DROP FUNCTION IF EXISTS public.update_team_details(UUID, JSONB, TEXT);

CREATE FUNCTION public.update_team_details(
  _token UUID,
  _team_members JSONB,
  _team_photo_url TEXT,
  _captain_name TEXT DEFAULT NULL,
  _captain_email TEXT DEFAULT NULL,
  _captain_phone TEXT DEFAULT NULL
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
    team_members   = COALESCE(_team_members, team_members),
    team_photo_url = COALESCE(_team_photo_url, team_photo_url),
    captain_name   = COALESCE(_captain_name, captain_name),
    captain_email  = COALESCE(_captain_email, captain_email),
    captain_phone  = COALESCE(_captain_phone, captain_phone)
  WHERE score_token = _token AND paid = true;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_team_details(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;