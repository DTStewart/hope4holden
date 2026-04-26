COMMENT ON COLUMN public.auction_items.market_value IS 'DEPRECATED: dollars. Use retail_value_cents instead. Will be dropped in a future migration once Auction.tsx and AuctionTab.tsx are migrated to read cents.';

COMMENT ON COLUMN public.rainbow_auction_winners.amount IS 'DEPRECATED: dollars. Use winning_amount_cents instead.';

COMMENT ON COLUMN public.rainbow_auction_winners.prize_description IS 'DEPRECATED: prize info now lives in rainbow_auction_prizes via prize_id.';