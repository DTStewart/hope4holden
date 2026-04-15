CREATE OR REPLACE FUNCTION public.decrement_sponsor_slots(_tier_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_val integer;
BEGIN
  UPDATE sponsorship_tiers
  SET max_slots = max_slots - 1,
      updated_at = now()
  WHERE id = _tier_id
    AND max_slots IS NOT NULL
    AND max_slots > 0
  RETURNING max_slots INTO new_val;

  RETURN COALESCE(new_val, -1);
END;
$$;