ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_size integer NOT NULL DEFAULT 4;

UPDATE public.registrations
   SET team_size = golfer_count
 WHERE is_extra_golfers = true
   AND golfer_count IS NOT NULL;

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
        AND r.tournament_year = public.get_current_tournament_year()) AS total_players,
    (SELECT COALESCE(SUM(d.quantity), 0)
       FROM public.dinners d
      WHERE d.paid = true
        AND d.tournament_year = public.get_current_tournament_year()) AS total_dinner_tickets;
$$;

REVOKE EXECUTE ON FUNCTION public.get_player_headcount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_headcount() TO authenticated, service_role;