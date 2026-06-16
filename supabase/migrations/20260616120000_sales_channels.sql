-- sales_channels: per-channel kill switch for the public sales surfaces
-- (registration, dinner, donation, sponsorship, auction). Lets an admin take a
-- single channel offline (with an optional public-facing message) without a code
-- change. The public pages read enabled state via the anon key, so SELECT is open;
-- writes are admin-only, mirroring the live_dashboard_settings / rainbow_auction_winners
-- RLS model already used in this schema.

CREATE TABLE public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE
    CHECK (channel IN ('registration', 'dinner', 'donation', 'sponsorship', 'auction')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  disabled_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed one row per channel, all enabled.
INSERT INTO public.sales_channels (channel, enabled) VALUES
  ('registration', true),
  ('dinner', true),
  ('donation', true),
  ('sponsorship', true),
  ('auction', true)
ON CONFLICT (channel) DO NOTHING;

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

-- Public read so the public/anon pages can check enabled state without auth.
CREATE POLICY "Anyone can read sales channels"
  ON public.sales_channels FOR SELECT
  USING (true);

-- Writes (INSERT/UPDATE/DELETE) admin-only. Matches the user_roles admin pattern
-- used elsewhere (see live_dashboard_settings, rainbow_auction_winners).
CREATE POLICY "Admins can manage sales channels"
  ON public.sales_channels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- is_channel_enabled: returns the enabled flag for a channel, defaulting to true
-- if the row is missing. Fail-open on read so a missing/renamed row never hard-breaks
-- the public site. SECURITY DEFINER so the anon key can call it without table grants.
CREATE OR REPLACE FUNCTION public.is_channel_enabled(channel_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.sales_channels WHERE channel = channel_name),
    true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_channel_enabled(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_channel_enabled(TEXT) TO anon, authenticated;
