ALTER FUNCTION public.move_to_dlq(text,text,bigint,jsonb) SET search_path = '';
ALTER FUNCTION public.read_email_batch(text,integer,integer) SET search_path = '';
ALTER FUNCTION public.enqueue_email(text,jsonb) SET search_path = '';
ALTER FUNCTION public.delete_email(text,bigint) SET search_path = '';

DROP POLICY "Anyone can read sales channels" ON public.sales_channels;
CREATE POLICY "Anyone can read known sales channels" ON public.sales_channels FOR SELECT
  USING (channel IN ('registration','donation','sponsorship','auction','dinner'));

DROP POLICY "Anyone can read rainbow winners" ON public.rainbow_auction_winners;

DROP POLICY "Anyone can read live dashboard settings" ON public.live_dashboard_settings;
CREATE POLICY "Admins can read live dashboard settings" ON public.live_dashboard_settings FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Anyone can read bids" ON public.auction_bids;
CREATE POLICY "Anyone can read bids on visible items" ON public.auction_bids FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.auction_items i WHERE i.id = auction_bids.item_id AND i.status IN ('open','closed')));

DROP POLICY "Anyone can read auction settings" ON public.auction_settings;
CREATE POLICY "Anyone can read the auction settings row" ON public.auction_settings FOR SELECT
  USING (id = 1);