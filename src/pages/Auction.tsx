import { useEffect, useMemo, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, CalendarDays, MapPin, CheckCircle } from "lucide-react";
import { useBidderSession } from "@/hooks/useBidderSession";
import { BidderRegistrationDialog } from "@/components/auction/BidderRegistrationDialog";
import { BidderAccountDialog } from "@/components/auction/BidderAccountDialog";
import { PlaceBidDialog } from "@/components/auction/PlaceBidDialog";

type Settings = {
  is_live: boolean;
  bidding_opens_at: string | null;
  bidding_closes_at: string | null;
  default_bid_increment: number;
};

type Item = {
  id: string;
  title: string;
  description: string | null;
  donated_by: string | null;
  images: Array<{ url: string; alt?: string }>;
  starting_bid: number;
  bid_increment: number | null;
  market_value: number;
  pickup_option: string;
  status: string;
  sort_order: number;
  ends_at: string | null;
};

type BidRow = {
  item_id: string;
  amount: number;
  bidder_id: string;
};

const PICKUP_LABELS: Record<string, string> = {
  thursday_dinner: "Pickup at Thursday dinner",
  friday_checkin: "Pickup at Friday check-in",
  contact_winner: "Contact winner to arrange",
  shippable: "Shippable (buyer pays shipping)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export default function Auction() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBids, setCurrentBids] = useState<Record<string, { amount: number; bidderId: string }>>({});

  const { bidder, refresh: refreshBidder } = useBidderSession();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bidDialogItem, setBidDialogItem] = useState<Item | null>(null);

  // Initial fetch of settings + items + seed current bids
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [settingsRes, itemsRes, bidsRes] = await Promise.all([
        anonSupabase
          .from("auction_settings")
          .select("is_live, bidding_opens_at, bidding_closes_at, default_bid_increment")
          .eq("id", 1)
          .single(),
        anonSupabase
          .from("auction_items")
          .select("id, title, description, donated_by, images, starting_bid, bid_increment, market_value, pickup_option, status, sort_order, ends_at")
          .in("status", ["open", "closed"])
          .order("sort_order", { ascending: true }),
        anonSupabase
          .from("auction_bids")
          .select("item_id, amount, bidder_id")
          .order("amount", { ascending: false }),
      ]);

      if (cancelled) return;
      if (settingsRes.data) setSettings(settingsRes.data as Settings);
      if (itemsRes.data) setItems(itemsRes.data as unknown as Item[]);
      if (bidsRes.data) {
        const map: Record<string, { amount: number; bidderId: string }> = {};
        for (const b of bidsRes.data as BidRow[]) {
          if (!map[b.item_id] || b.amount > map[b.item_id].amount) {
            map[b.item_id] = { amount: b.amount, bidderId: b.bidder_id };
          }
        }
        setCurrentBids(map);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Realtime: listen for new bids and update the current-high map live.
  useEffect(() => {
    const channel = anonSupabase
      .channel("auction-bids-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "auction_bids" },
        (payload) => {
          const row = payload.new as BidRow;
          setCurrentBids((prev) => {
            const existing = prev[row.item_id];
            if (!existing || row.amount > existing.amount) {
              return { ...prev, [row.item_id]: { amount: row.amount, bidderId: row.bidder_id } };
            }
            return prev;
          });
        }
      )
      // Also pick up admin edits (ends_at extensions, status changes, etc.)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auction_items" },
        (payload) => {
          const updated = payload.new as Item;
          setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
        }
      )
      .subscribe();

    return () => {
      anonSupabase.removeChannel(channel);
    };
  }, []);

  const biddingOpensAt = useMemo(
    () => (settings?.bidding_opens_at ? new Date(settings.bidding_opens_at) : null),
    [settings?.bidding_opens_at]
  );
  const biddingOpenNow = biddingOpensAt ? Date.now() >= biddingOpensAt.getTime() : false;

  const handleBidClick = (item: Item) => {
    if (!bidder) {
      setBidDialogItem(item); // remember intent; we'll open bid dialog after registration
      setRegisterOpen(true);
      return;
    }
    if (!bidder.has_payment_method) {
      // Registered but no card — take them back through the card step.
      setBidDialogItem(item);
      setRegisterOpen(true);
      return;
    }
    setBidDialogItem(item);
  };

  const onRegistered = async () => {
    await refreshBidder();
    // If they clicked a specific item before registering, the bid dialog pops next.
  };

  if (loading) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  // Placeholder when auction isn't live yet
  if (!settings?.is_live) {
    return (
      <div>
        <section className="section-dark relative overflow-hidden">
          <div className="container py-20 md:py-28 animate-fade-in relative z-10 text-center">
            <Gavel className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="section-label">Coming Soon</p>
            <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
              Silent Auction
            </h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Bidding opens June 1 and closes during the tournament dinner on Thursday, June 18, 2026.
            </p>
          </div>
        </section>

        <section className="section-light">
          <div className="container py-16 md:py-20 max-w-2xl">
            <div className="space-y-6 text-foreground/70 leading-relaxed text-left">
              <p className="text-lg">
                Our silent auction features items donated by local businesses and friends of the Stewart family,
                with every dollar raised going toward Ataxia Telangiectasia research through ATCP.
              </p>
              <div className="bg-accent/10 border border-accent/20 rounded p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <CalendarDays className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading font-bold text-foreground">Auction timing</p>
                    <p className="text-sm text-foreground/70">
                      Bidding opens June 1, 2026. Closes during the tournament dinner on Thursday, June 18.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading font-bold text-foreground">Pickup</p>
                    <p className="text-sm text-foreground/70">
                      Items collected Thursday night at dinner, Friday at tournament check-in, or arranged directly
                      with winners who can't attend.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-foreground/60">
                Bookmark this page — you'll be able to bid from any device with a saved card.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Live
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10 text-center">
          <p className="section-label">Fundraiser</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Silent Auction
          </h1>
          {!biddingOpenNow && settings.bidding_opens_at && (
            <p className="text-white/70 text-lg">Bidding opens {formatDate(settings.bidding_opens_at)}</p>
          )}
          {biddingOpenNow && settings.bidding_closes_at && (
            <p className="text-white/70 text-lg">Bidding closes {formatDate(settings.bidding_closes_at)}</p>
          )}
          {bidder && (
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="mt-4 inline-flex items-center gap-2 text-xs text-white/80 bg-white/10 hover:bg-white/15 rounded-full px-4 py-1.5 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
              Signed in as {bidder.display_name}
              {bidder.has_payment_method ? "" : " — add a card"}
              <span className="text-white/40 ml-1">· Account</span>
            </button>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-12 md:py-16">
          {!biddingOpenNow && (
            <div className="bg-accent/10 border border-accent/20 rounded p-4 text-center mb-8 text-sm text-foreground/70">
              Browse below. Bidding opens {settings.bidding_opens_at ? formatDate(settings.bidding_opens_at) : "soon"}.
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-center text-foreground/60 py-12">More items coming soon — check back.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => {
                const current = currentBids[item.id];
                const closed = item.status === "closed";
                const canBid = biddingOpenNow && !closed && settings.is_live;
                return (
                  <article key={item.id} className="bg-white border border-[#1A1A1A]/10 rounded overflow-hidden flex flex-col">
                    {item.images?.[0]?.url ? (
                      <img
                        src={item.images[0].url}
                        alt={item.images[0].alt || item.title}
                        className="w-full aspect-[4/3] object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-muted" />
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-heading font-extrabold text-lg text-foreground mb-1">{item.title}</h3>
                      {item.donated_by && (
                        <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
                          Donated by {item.donated_by}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-sm text-foreground/70 mb-4 line-clamp-3">{item.description}</p>
                      )}
                      <div className="mt-auto space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-foreground/60">Current bid</span>
                          <span className="font-heading font-bold text-primary text-base">
                            {current ? `$${current.amount.toLocaleString()}` : `Starting at $${item.starting_bid.toLocaleString()}`}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-foreground/50">Retail value</span>
                          <span className="text-foreground/50">${item.market_value.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1">
                          <span className="text-foreground/50">{PICKUP_LABELS[item.pickup_option] || item.pickup_option}</span>
                        </div>
                      </div>
                      {closed ? (
                        <Button className="w-full mt-4 rounded" disabled variant="secondary">Bidding closed</Button>
                      ) : canBid ? (
                        <Button className="w-full mt-4 rounded" onClick={() => handleBidClick(item)}>
                          <Gavel className="h-4 w-4 mr-2" />
                          {bidder?.has_payment_method ? "Place bid" : "Register & bid"}
                        </Button>
                      ) : (
                        <Button className="w-full mt-4 rounded" disabled variant="outline">
                          Bidding not yet open
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <BidderRegistrationDialog
        open={registerOpen}
        onOpenChange={(o) => {
          setRegisterOpen(o);
          // If registration closes while we remembered an item, try to continue to bid dialog.
          if (!o && bidDialogItem && bidder?.has_payment_method) {
            // noop — bid dialog will open via onRegistered flow below
          }
        }}
        onRegistered={onRegistered}
      />

      {bidDialogItem && bidder?.has_payment_method && (
        <PlaceBidDialog
          open={!!bidDialogItem && !registerOpen}
          onOpenChange={(o) => { if (!o) setBidDialogItem(null); }}
          item={bidDialogItem}
          currentBid={currentBids[bidDialogItem.id]?.amount ?? null}
          defaultIncrement={settings.default_bid_increment}
          bidderAttending={bidder?.attending_event ?? false}
          onBidPlaced={() => {
            // Realtime subscription will update the card, nothing else to do.
          }}
        />
      )}

      {bidder && (
        <BidderAccountDialog
          open={accountOpen}
          onOpenChange={setAccountOpen}
          bidder={bidder}
          onChanged={() => refreshBidder()}
          onSignedOut={() => refreshBidder()}
        />
      )}
    </div>
  );
}
