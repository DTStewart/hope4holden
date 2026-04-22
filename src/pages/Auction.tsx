import { useEffect, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, CalendarDays, MapPin } from "lucide-react";

type Settings = {
  is_live: boolean;
  bidding_opens_at: string | null;
  bidding_closes_at: string | null;
};

type Item = {
  id: string;
  title: string;
  description: string | null;
  donated_by: string | null;
  images: Array<{ url: string; alt?: string }>;
  starting_bid: number;
  market_value: number;
  pickup_option: string;
  status: string;
  sort_order: number;
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
  return d.toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Auction() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [settingsRes, itemsRes] = await Promise.all([
        anonSupabase.from("auction_settings").select("is_live, bidding_opens_at, bidding_closes_at").eq("id", 1).single(),
        anonSupabase
          .from("auction_items")
          .select("id, title, description, donated_by, images, starting_bid, market_value, pickup_option, status, sort_order")
          .in("status", ["open", "closed"])
          .order("sort_order", { ascending: true }),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data as Settings);
      if (itemsRes.data) setItems((itemsRes.data as unknown as Item[]) || []);
      setLoading(false);
    })();
  }, []);

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
                Our silent auction features items donated by local businesses and friends of the Stewart family, with
                every dollar raised going toward Ataxia Telangiectasia research through ATCP.
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
                Bookmark this page — you'll be able to bid from any device, with email and text alerts when you're outbid.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Live — show items (read-only for Phase 1; bidding arrives in Phase 2)
  const biddingOpensAt = settings.bidding_opens_at ? new Date(settings.bidding_opens_at) : null;
  const biddingOpen = biddingOpensAt ? Date.now() >= biddingOpensAt.getTime() : false;

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10 text-center">
          <p className="section-label">Fundraiser</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Silent Auction
          </h1>
          {!biddingOpen && settings.bidding_opens_at && (
            <p className="text-white/70 text-lg">
              Bidding opens {formatDate(settings.bidding_opens_at)}
            </p>
          )}
          {biddingOpen && settings.bidding_closes_at && (
            <p className="text-white/70 text-lg">
              Bidding closes {formatDate(settings.bidding_closes_at)}
            </p>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-12 md:py-16">
          {!biddingOpen && (
            <div className="bg-accent/10 border border-accent/20 rounded p-4 text-center mb-8 text-sm text-foreground/70">
              Browse the items below. Bidding opens {settings.bidding_opens_at ? formatDate(settings.bidding_opens_at) : "soon"}.
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-center text-foreground/60 py-12">More items coming soon — check back.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
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
                        <span className="text-foreground/60">Starting bid</span>
                        <span className="font-bold">${item.starting_bid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground/60">Retail value</span>
                        <span>${item.market_value.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-2">
                        <span className="text-foreground/50">{PICKUP_LABELS[item.pickup_option] || item.pickup_option}</span>
                      </div>
                    </div>
                    {biddingOpen ? (
                      <Button className="w-full mt-4 rounded" disabled>
                        Place bid (coming soon)
                      </Button>
                    ) : (
                      <Button className="w-full mt-4 rounded" disabled variant="outline">
                        Bidding not yet open
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
