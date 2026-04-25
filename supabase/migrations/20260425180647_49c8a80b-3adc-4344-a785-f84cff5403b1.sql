CREATE OR REPLACE FUNCTION public.get_public_recent_donors(_limit integer DEFAULT 10)
 RETURNS TABLE(display_name text, amount integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN d.public_display_consent = true
        THEN COALESCE(
          NULLIF(TRIM(d.public_display_name), ''),
          split_part(d.donor_name, ' ', 1)
        )
      ELSE 'A friend of Holden'
    END AS display_name,
    d.amount,
    d.created_at
  FROM public.donations d
  WHERE d.paid = true
    AND d.tournament_year = public.get_current_tournament_year()
  ORDER BY d.created_at DESC
  LIMIT GREATEST(LEAST(_limit, 50), 1);
$function$;