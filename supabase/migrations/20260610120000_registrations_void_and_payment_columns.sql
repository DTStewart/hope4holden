-- Add void + manual-entry + payment-tracking columns to registrations, and
-- teach the headcount / fundraising RPCs to ignore voided rows.
--
-- The payment column names (payment_method, payment_reference), the
-- payment_method enum values, and entered_manually are deliberately chosen to
-- match the planned contact_activities schema in the CRM handover, so a future
-- backfill can read these straight across with no renaming or value mapping.

-- ----------------------------------------------------------------------------
-- 1. New columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS voided_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe', 'cash', 'cheque', 'eft', 'in_kind', 'other')),
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS entered_manually boolean NOT NULL DEFAULT false;

-- Forward-compatibility notes: these column names + values mirror the planned
-- CRM contact_activities schema so the eventual backfill reads straight across.
COMMENT ON COLUMN public.registrations.payment_method IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name and enum values (stripe, cash, cheque, eft, in_kind, other) so a future backfill maps straight across with no renaming.';
COMMENT ON COLUMN public.registrations.payment_reference IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name so a future backfill maps straight across with no renaming.';
COMMENT ON COLUMN public.registrations.entered_manually IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name so a future backfill maps straight across with no renaming.';

-- ----------------------------------------------------------------------------
-- 2. get_player_headcount() — exclude voided registrations
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_headcount()
RETURNS TABLE(total_players bigint, total_dinner_tickets bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COALESCE(SUM(r.team_size), 0)
       FROM public.registrations r
      WHERE r.paid = true
        AND r.voided_at IS NULL
        AND r.tournament_year = public.get_current_tournament_year()) AS total_players,
    (SELECT COALESCE(SUM(d.quantity), 0)
       FROM public.dinners d
      WHERE d.paid = true
        AND d.tournament_year = public.get_current_tournament_year()) AS total_dinner_tickets;
$$;

REVOKE EXECUTE ON FUNCTION public.get_player_headcount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_headcount() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. get_fundraising_total() — exclude voided registrations
-- ----------------------------------------------------------------------------
-- NOTE: This RPC counts teams as a flat COUNT(*) * $600 and does NOT filter by
-- tournament_year. Both of those are known and intentionally OUT OF SCOPE for
-- this migration; the only change here is adding `voided_at IS NULL` to the
-- registrations predicate. Do not "fix" the flat count or add a year filter
-- here -- those are deliberately deferred to a separate change.
CREATE OR REPLACE FUNCTION public.get_fundraising_total()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_team_price CONSTANT INTEGER := 600;
  v_teams INTEGER;
  v_sponsors INTEGER;
  v_donations INTEGER;
  v_dinners INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_teams FROM public.registrations WHERE paid = true AND voided_at IS NULL;
  SELECT COALESCE(SUM(amount), 0) INTO v_sponsors FROM public.sponsors WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_donations FROM public.donations WHERE paid = true;
  SELECT COALESCE(SUM(amount), 0) INTO v_dinners FROM public.dinners WHERE paid = true;

  RETURN jsonb_build_object(
    'total_raised', v_teams * v_team_price + v_sponsors + v_donations + v_dinners,
    'teams_count', v_teams,
    'sponsors_total', v_sponsors,
    'donations_total', v_donations,
    'dinners_total', v_dinners
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_fundraising_total() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_fundraising_total() TO authenticated;
