-- Team-manage form redesign: extend two team RPCs.
--
-- ============================================================================
-- WARNING: SECURITY DEFINER functions, DROP and CREATE (not CREATE OR REPLACE)
-- ============================================================================
-- Both functions below are SECURITY DEFINER and run with the owner's rights, so
-- their EXECUTE privileges matter. We DROP and CREATE rather than CREATE OR
-- REPLACE for two reasons:
--   1. get_team_for_management changes its RETURNS TABLE (return type). Postgres
--      does not allow CREATE OR REPLACE to change a function's return type, so a
--      DROP is required.
--   2. update_team_details changes its argument list (3 args to 6 args), which
--      is a new function identity.
-- DROP resets all privileges, so the explicit REVOKE/GRANT lines after each
-- CREATE re-apply exactly the grants the current definitions carry
-- (REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO anon, authenticated). Keep those
-- in sync or the captain-facing anon calls will start returning permission
-- errors.
--
-- CALLER COMPATIBILITY (read before applying):
--   - get_team_for_management(_token UUID): the ARGUMENT signature is unchanged
--     (still one UUID). Only added return columns. The existing front-end call
--     keeps working and simply receives two extra fields, so there is no break.
--   - update_team_details: the deployed front-end still calls the OLD 3-argument
--     form (_token, _team_members, _team_photo_url). To avoid breaking that call
--     in the window between applying this migration and Lovable shipping the new
--     form, the three new captain parameters are declared DEFAULT NULL. PostgREST
--     resolves an old 3-key call to this 6-parameter function (the three captain
--     args default to NULL, and COALESCE then preserves the existing captain_*
--     values). So there is NO breakage window with the defaults in place.
--     If a strict 6-required-argument signature is preferred instead, remove the
--     DEFAULT NULLs; that WOULD break old 3-arg callers until the new form ships.

-- ---------------------------------------------------------------------------
-- Change 1: get_team_for_management — add golfer_count and captain_phone
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Change 2: update_team_details — also write captain_name/email/phone
-- ---------------------------------------------------------------------------
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
