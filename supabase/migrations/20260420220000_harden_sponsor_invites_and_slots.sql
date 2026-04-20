-- Drop overly permissive public SELECT on sponsor_invites (exposed all invite tokens to enumeration)
DROP POLICY IF EXISTS "Anyone can read sponsor invites by token" ON public.sponsor_invites;

-- Security-definer token lookup: caller must know the exact token to get any row back
CREATE OR REPLACE FUNCTION public.lookup_sponsor_invite(invite_token uuid)
RETURNS SETOF public.sponsor_invites
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.sponsor_invites WHERE token = invite_token LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_sponsor_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_sponsor_invite(uuid) TO anon, authenticated;

-- Lock down decrement_sponsor_slots to service_role only (previously callable by any user)
REVOKE EXECUTE ON FUNCTION public.decrement_sponsor_slots(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_sponsor_slots(uuid) TO service_role;
