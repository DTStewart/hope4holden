-- Add a true amount_paid to registrations and teach get_fundraising_total() to
-- use it where present, falling back to the flat $600 assumption otherwise.

-- ----------------------------------------------------------------------------
-- 1. amount_paid column (integer DOLLARS, not cents)
-- ----------------------------------------------------------------------------
-- Dollars (not cents) deliberately: every other amount column in this schema is
-- integer dollars, so amount_paid matches that convention. The eventual CRM
-- contact_activities standard stores cents, but that conversion happens at
-- write time, so matching the local schema convention wins here.
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS amount_paid integer;

COMMENT ON COLUMN public.registrations.amount_paid IS
  'True amount paid for this registration, in integer dollars (not cents), for rows where it differs from the flat $600 assumption, such as admin-initiated links for teams of 5 or 6 priced at $600 + $150 per golfer above 4. Nullable: existing rows remain null and are treated as $600 by get_fundraising_total(). Forward-compatible with the planned CRM contact_activities amount tracking.';

-- ----------------------------------------------------------------------------
-- 2. get_fundraising_total() — registrations revenue uses true amount where set
-- ----------------------------------------------------------------------------
-- Based on the currently deployed definition (migration 20260610120000 /
-- re-applied as 20260610160328). The ONLY change is the registrations revenue
-- line: it now sums COALESCE(amount_paid, 600) instead of COUNT(*) * 600.
--
-- teams_count stays a COUNT(*) of the same rows, so the team count is unchanged
-- and any consumer reading teams_count sees no shift -- only the dollar total
-- moves. The voided_at IS NULL predicate from the prior migration is preserved.
-- tournament_year filtering remains deliberately OUT OF SCOPE here.
CREATE OR REPLACE FUNCTION public.get_fundraising_total()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_team_price CONSTANT INTEGER := 600;
  v_teams_count INTEGER;
  v_teams_revenue INTEGER;
  v_sponsors INTEGER;
  v_donations INTEGER;
  v_dinners INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(COALESCE(amount_paid, v_team_price)), 0)
    INTO v_teams_count, v_teams_revenue
    FROM public.registrations
   WHERE paid = true AND voided_at IS NULL;

  SELECT COALESCE(SUM(amount), 0) INTO v_sponsors FROM public.sponsors WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_donations FROM public.donations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_dinners FROM public.dinners WHERE paid = true;

  RETURN jsonb_build_object(
    'total_raised', v_teams_revenue + v_sponsors + v_donations + v_dinners,
    'teams_count', v_teams_count,
    'sponsors_total', v_sponsors,
    'donations_total', v_donations,
    'dinners_total', v_dinners
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_fundraising_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fundraising_total() TO authenticated;
