
-- Auction settings (single row, id=1)
CREATE TABLE public.auction_settings (
  id integer PRIMARY KEY DEFAULT 1,
  is_live boolean NOT NULL DEFAULT false,
  bidding_opens_at timestamptz,
  bidding_closes_at timestamptz,
  anti_snipe_seconds integer NOT NULL DEFAULT 60,
  default_bid_increment integer NOT NULL DEFAULT 5,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auction_settings_singleton CHECK (id = 1)
);

INSERT INTO public.auction_settings (id) VALUES (1);

ALTER TABLE public.auction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read auction settings"
  ON public.auction_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage auction settings"
  ON public.auction_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auction items
CREATE TABLE public.auction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  donated_by text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  starting_bid integer NOT NULL DEFAULT 0,
  bid_increment integer,
  market_value integer NOT NULL DEFAULT 0,
  pickup_option text NOT NULL DEFAULT 'contact_winner',
  pickup_notes text,
  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-draft auction items"
  ON public.auction_items FOR SELECT
  USING (status IN ('open', 'closed'));

CREATE POLICY "Admins can manage auction items"
  ON public.auction_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_auction_settings_updated_at
  BEFORE UPDATE ON public.auction_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auction_items_updated_at
  BEFORE UPDATE ON public.auction_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
