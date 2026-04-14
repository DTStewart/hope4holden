CREATE OR REPLACE FUNCTION public.decrement_spots()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_val integer;
BEGIN
  UPDATE settings
  SET value = to_jsonb((value::text)::integer - 1),
      updated_at = now()
  WHERE key = 'spots_remaining'
    AND (value::text)::integer > 0
  RETURNING (value::text)::integer INTO new_val;

  RETURN COALESCE(new_val, 0);
END;
$$;