
CREATE TABLE public.sponsor_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id uuid REFERENCES public.sponsorship_tiers(id) NOT NULL,
  tier_name text NOT NULL,
  amount integer NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '14 days'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsor_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sponsor invites"
  ON public.sponsor_invites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read sponsor invites by token"
  ON public.sponsor_invites FOR SELECT
  USING (true);

CREATE POLICY "Service role can update invites"
  ON public.sponsor_invites FOR UPDATE
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
