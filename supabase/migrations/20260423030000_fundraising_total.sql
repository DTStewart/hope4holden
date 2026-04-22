-- Shared fundraising-total RPC for reuse by PostEventTab (#15), the public
-- live dashboard (#4 already inlined the same math), and any future surface
-- that wants a single authoritative number.
--
-- Mirrors the calc in src/pages/admin/DashboardStats.tsx:
--   teams (paid) * $600 + sum(paid sponsors/donations/dinners).

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
  SELECT COUNT(*) INTO v_teams FROM public.registrations WHERE paid = true;
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
