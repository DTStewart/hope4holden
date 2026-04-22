-- Phase 1: Silent auction foundations — settings, items, and storage bucket.
-- Bidders and bids arrive in Phase 2; nothing here enables actual bidding yet.

-- 1. Singleton settings row (single global configuration for the auction)
CREATE TABLE public.auction_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_live BOOLEAN NOT NULL DEFAULT false,
  bidding_opens_at TIMESTAMPTZ,
  bidding_closes_at TIMESTAMPTZ,
  anti_snipe_seconds INT NOT NULL DEFAULT 60,
  default_bid_increment INT NOT NULL DEFAULT 5,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the one row
INSERT INTO public.auction_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.auction_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read auction settings so the public page knows whether to show
-- the coming-soon placeholder or the item grid.
CREATE POLICY "Anyone can read auction settings"
  ON public.auction_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update auction settings"
  ON public.auction_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_auction_settings_updated_at
  BEFORE UPDATE ON public.auction_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Auction items
CREATE TABLE public.auction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  donated_by TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of { url, alt? }
  starting_bid INTEGER NOT NULL CHECK (starting_bid >= 0),
  bid_increment INTEGER,  -- null => use auction_settings.default_bid_increment
  market_value INTEGER NOT NULL CHECK (market_value >= 0),
  pickup_option TEXT NOT NULL DEFAULT 'thursday_dinner'
    CHECK (pickup_option IN ('thursday_dinner', 'friday_checkin', 'contact_winner', 'shippable')),
  pickup_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  ends_at TIMESTAMPTZ,  -- null => uses global auction_settings.bidding_closes_at
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auction_items_sort_idx ON public.auction_items(sort_order);
CREATE INDEX auction_items_status_idx ON public.auction_items(status);

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;

-- Public reads: only items that are not drafts (so admins can stage items privately)
CREATE POLICY "Anyone can read non-draft auction items"
  ON public.auction_items FOR SELECT
  USING (status <> 'draft');

CREATE POLICY "Admins can manage all auction items"
  ON public.auction_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_auction_items_updated_at
  BEFORE UPDATE ON public.auction_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. Storage bucket for auction item images (public so items can render without signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('auction-items', 'auction-items', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read (view images), only admins can write
CREATE POLICY "Anyone can view auction images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'auction-items');

CREATE POLICY "Admins can upload auction images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update auction images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete auction images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'auction-items' AND has_role(auth.uid(), 'admin'::app_role));
