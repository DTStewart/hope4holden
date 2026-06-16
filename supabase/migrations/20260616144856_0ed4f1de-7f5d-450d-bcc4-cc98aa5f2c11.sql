CREATE TABLE public.sales_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL UNIQUE
    CHECK (channel IN ('registration', 'dinner', 'donation', 'sponsorship', 'auction')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  disabled_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

GRANT SELECT ON public.sales_channels TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sales_channels TO authenticated;
GRANT ALL ON public.sales_channels TO service_role;

INSERT INTO public.sales_channels (channel, enabled) VALUES
  ('registration', true),
  ('dinner', true),
  ('donation', true),
  ('sponsorship', true),
  ('auction', true)
ON CONFLICT (channel) DO NOTHING;

ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sales channels"
  ON public.sales_channels FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage sales channels"
  ON public.sales_channels FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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