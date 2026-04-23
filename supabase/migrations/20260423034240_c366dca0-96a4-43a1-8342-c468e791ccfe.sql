-- Add columns to registrations to support "extra golfer" payment links
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS is_extra_golfers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS golfing_with text,
  ADD COLUMN IF NOT EXISTS golfer_count integer,
  ADD COLUMN IF NOT EXISTS parent_token uuid;

-- Table to hold admin-generated extra-golfer invite links
CREATE TABLE IF NOT EXISTS public.extra_golfer_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  golfer_count integer NOT NULL CHECK (golfer_count BETWEEN 1 AND 8),
  price_per_golfer integer NOT NULL DEFAULT 15000, -- cents, $150
  golfing_with text,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE public.extra_golfer_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage extra golfer invites"
  ON public.extra_golfer_invites FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public lookup function (no auth required) so the recipient page can load invite info
CREATE OR REPLACE FUNCTION public.lookup_extra_golfer_invite(_token uuid)
RETURNS TABLE(id uuid, token uuid, golfer_count integer, price_per_golfer integer, golfing_with text, used boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, token, golfer_count, price_per_golfer, golfing_with, used
  FROM public.extra_golfer_invites
  WHERE token = _token
  LIMIT 1;
$$;