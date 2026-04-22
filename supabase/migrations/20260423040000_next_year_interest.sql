-- 2027 save-the-date waitlist. Emails fed by the post-event recap (#15).

CREATE TABLE public.next_year_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  attended_prior_year BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'direct'
    CHECK (source IN ('post_event_email', 'direct', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency by normalized email so a re-click doesn't double-insert.
CREATE UNIQUE INDEX next_year_interest_email_lower_idx
  ON public.next_year_interest (lower(email));

ALTER TABLE public.next_year_interest ENABLE ROW LEVEL SECURITY;

-- Public can't read; admin full access. Writes happen via the RPC below.
CREATE POLICY "Admins can manage next-year interest"
  ON public.next_year_interest FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- Public-callable idempotent upsert.
CREATE OR REPLACE FUNCTION public.add_next_year_interest(
  _email TEXT,
  _name TEXT DEFAULT NULL,
  _attended_prior_year BOOLEAN DEFAULT false,
  _source TEXT DEFAULT 'direct'
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

  -- Explicit upsert — using ON CONFLICT on an expression index is
  -- supported but brittle; a direct update-or-insert is clearer.
  UPDATE public.next_year_interest
     SET name = COALESCE(v_clean_name, name),
         attended_prior_year = attended_prior_year OR COALESCE(_attended_prior_year, false)
   WHERE lower(email) = v_clean_email;

  IF NOT FOUND THEN
    INSERT INTO public.next_year_interest (email, name, attended_prior_year, source)
    VALUES (v_clean_email, v_clean_name, COALESCE(_attended_prior_year, false), v_clean_source);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_next_year_interest(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_next_year_interest(TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
