-- registration_invites: admin-generated, payer-completed team registration links.
CREATE TABLE public.registration_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_size integer NOT NULL CHECK (team_size IN (4, 5, 6)),
  amount integer NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage registration invites"
  ON public.registration_invites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can update invites"
  ON public.registration_invites FOR UPDATE
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE OR REPLACE FUNCTION public.lookup_registration_invite(invite_token uuid)
RETURNS SETOF public.registration_invites
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.registration_invites WHERE token = invite_token LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_registration_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_registration_invite(uuid) TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_invites TO authenticated;
GRANT ALL ON public.registration_invites TO service_role;