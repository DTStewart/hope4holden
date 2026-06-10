ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS voided_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe', 'cash', 'cheque', 'eft', 'in_kind', 'other')),
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS entered_manually boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.registrations.payment_method IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name and enum values (stripe, cash, cheque, eft, in_kind, other) so a future backfill maps straight across with no renaming.';
COMMENT ON COLUMN public.registrations.payment_reference IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name so a future backfill maps straight across with no renaming.';
COMMENT ON COLUMN public.registrations.entered_manually IS
  'Forward-compatible with the planned CRM contact_activities migration: same column name so a future backfill maps straight across with no renaming.';

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