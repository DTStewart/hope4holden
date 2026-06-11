-- registration_invites: admin-generated, payer-completed team registration links.
-- Mirrors public.sponsor_invites and its hardened lookup-RPC access model. The
-- admin sets team_size and amount at link time; the payer can never change
-- either. Buyer-collected contact/team details ride in pending_orders.formData,
-- exactly as the sponsor invite flow works.

CREATE TABLE public.registration_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- team_size is a fixed three-value enum that DRIVES pricing, so it is
  -- constrained at the DB level too. This is a deliberate divergence from
  -- sponsor_invites, whose amount is genuinely variable and so is unconstrained.
  team_size integer NOT NULL CHECK (team_size IN (4, 5, 6)),
  amount integer NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

-- RLS mirrors the hardened sponsor_invites end state: admins manage; service_role
-- updates (to burn used); NO public SELECT policy (token reads go through the
-- security-definer lookup RPC below, matching the sponsor hardening).
CREATE POLICY "Admins can manage registration invites"
  ON public.registration_invites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can update invites"
  ON public.registration_invites FOR UPDATE
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- Security-definer token lookup: caller must know the exact token to get a row
-- back. Mirrors public.lookup_sponsor_invite exactly, including the grant block.
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
