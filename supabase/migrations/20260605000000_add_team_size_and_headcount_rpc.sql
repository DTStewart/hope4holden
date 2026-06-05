-- Add a per-registration team_size and a headcount RPC.
--
-- team_size is the number of players that registration covers. Regular team
-- registrations are 4-person teams (the default). Extra-golfer registrations
-- (is_extra_golfers = true) cover golfer_count players, so we backfill those
-- from the existing golfer_count column.
--
-- get_player_headcount() then reports, for the current tournament year:
--   total_players        = SUM(team_size) over PAID registrations
--   total_dinner_tickets = SUM(dinners.quantity) over PAID dinners
-- (dinner tickets are counted by quantity, since one dinners row can hold
--  several tickets — see stripe-webhook inserting quantity per order.)

-- ----------------------------------------------------------------------------
-- 1. Column + backfill
-- ----------------------------------------------------------------------------
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_size integer NOT NULL DEFAULT 4;

-- The NOT NULL DEFAULT above already set every existing row to 4 (regular teams
-- are done). Now override the extra-golfer rows with their actual golfer_count.
-- Guard on golfer_count IS NOT NULL so a stray null can't violate NOT NULL;
-- any such row simply keeps the default of 4.
UPDATE public.registrations
   SET team_size = golfer_count
 WHERE is_extra_golfers = true
   AND golfer_count IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. get_player_headcount() RPC
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
        AND r.tournament_year = public.get_current_tournament_year()) AS total_players,
    (SELECT COALESCE(SUM(d.quantity), 0)
       FROM public.dinners d
      WHERE d.paid = true
        AND d.tournament_year = public.get_current_tournament_year()) AS total_dinner_tickets;
$$;

-- Grant model: revoke the PUBLIC default-grant (this is what removes the
-- implicit anon access), then grant only to the roles that should call it.
REVOKE EXECUTE ON FUNCTION public.get_player_headcount() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_headcount() TO authenticated, service_role;
