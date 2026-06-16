-- Backfill phone/team_name on the duplicate-email UPDATE branch of
-- add_next_year_interest: fill them in only when the stored value is null, never
-- overwriting an existing value and never overwriting with a blank. COALESCE keeps
-- the existing value when present; the cleaned input uses the same
-- NULLIF(btrim(...), '') treatment as the insert path so a blank stays null.
-- Name-enrichment behavior is unchanged. Signature is unchanged, so CREATE OR
-- REPLACE preserves the existing anon/authenticated EXECUTE grants.

CREATE OR REPLACE FUNCTION public.add_next_year_interest(
  _email TEXT,
  _name TEXT DEFAULT NULL,
  _attended_prior_year BOOLEAN DEFAULT false,
  _source TEXT DEFAULT 'direct',
  _phone TEXT DEFAULT NULL,
  _team_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_email TEXT;
  v_clean_name TEXT;
  v_clean_source TEXT;
  v_clean_phone TEXT;
  v_clean_team_name TEXT;
BEGIN
  IF _email IS NULL OR btrim(_email) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_email');
  END IF;

  v_clean_email := lower(btrim(_email));
  IF position('@' IN v_clean_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_email');
  END IF;

  v_clean_name := NULLIF(btrim(COALESCE(_name, '')), '');
  v_clean_source := CASE
    WHEN _source IN ('post_event_email', 'direct', 'other') THEN _source
    ELSE 'direct'
  END;
  v_clean_phone := NULLIF(btrim(COALESCE(_phone, '')), '');
  v_clean_team_name := NULLIF(btrim(COALESCE(_team_name, '')), '');

  -- Explicit upsert — using ON CONFLICT on an expression index is
  -- supported but brittle; a direct update-or-insert is clearer.
  UPDATE public.next_year_interest
     SET name = COALESCE(v_clean_name, name),
         attended_prior_year = attended_prior_year OR COALESCE(_attended_prior_year, false),
         phone = COALESCE(phone, v_clean_phone),
         team_name = COALESCE(team_name, v_clean_team_name)
   WHERE lower(email) = v_clean_email;

  IF NOT FOUND THEN
    INSERT INTO public.next_year_interest (email, name, attended_prior_year, source, phone, team_name)
    VALUES (v_clean_email, v_clean_name, COALESCE(_attended_prior_year, false), v_clean_source, v_clean_phone, v_clean_team_name);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;
