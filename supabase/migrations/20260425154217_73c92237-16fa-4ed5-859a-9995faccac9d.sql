-- Donor opt-in for the homepage donation ticker.
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS public_display_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_display_name text;

COMMENT ON COLUMN public.donations.public_display_consent IS
  'Donor opted in to have their donation visible on the public supporter list. Default false (opt-in only).';
COMMENT ON COLUMN public.donations.public_display_name IS
  'Optional display name. If null but consent is true, fall back to first name from the donor name field.';

-- Public RPC powering the homepage donation ticker.
CREATE OR REPLACE FUNCTION public.get_public_recent_donors(_limit integer DEFAULT 10)
RETURNS TABLE(
  display_name text,
  amount integer,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN d.public_display_consent = true
        THEN COALESCE(
          NULLIF(TRIM(d.public_display_name), ''),
          split_part(d.donor_name, ' ', 1)
        )
      ELSE 'Anonymous donor'
    END AS display_name,
    d.amount,
    d.created_at
  FROM public.donations d
  WHERE d.paid = true
    AND d.tournament_year = public.get_current_tournament_year()
  ORDER BY d.created_at DESC
  LIMIT GREATEST(LEAST(_limit, 50), 1);
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_recent_donors(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_recent_donors(integer) TO anon, authenticated;