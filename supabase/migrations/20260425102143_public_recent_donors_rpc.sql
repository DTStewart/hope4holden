-- Public RPC powering the homepage donation ticker.
--
-- Returns the N most recent paid donations for the current tournament
-- year. Names are filtered through donor consent: opted-in rows show
-- a display name; opted-out rows show "Anonymous donor". Amount is
-- returned in dollars (matching the rest of the codebase — donations.amount
-- is stored as integer dollars, not cents).
--
-- !! FUTURE EDITORS — READ BEFORE TOUCHING THIS FUNCTION !!
-- If you ever modify get_public_recent_donors, use CREATE OR REPLACE
-- FUNCTION, which preserves existing GRANTs and REVOKEs. Do NOT use
-- DROP FUNCTION followed by CREATE FUNCTION — that path discards the
-- privilege state and Postgres re-grants EXECUTE to PUBLIC by default
-- on the new definition, silently widening the function's reach.
--
-- If a DROP + CREATE is unavoidable (e.g. signature change), the new
-- migration MUST also re-apply the REVOKE/GRANT pair below to restore
-- the explicit grant model.

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
