CREATE OR REPLACE FUNCTION public.get_public_supporter_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.donations
  WHERE paid = true
    AND tournament_year = public.get_current_tournament_year();
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_supporter_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_supporter_count() TO anon, authenticated;