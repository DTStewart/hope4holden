import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Star, Award, Medal, Flag, ShoppingCart, Utensils, CreditCard, Droplets, Gift, Heart, Trophy, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import sponsorHero from "@/assets/sponsor-hero.jpeg";

const tierIcons: Record<string, any> = {
  "Presenting Sponsor": Star,
  "Merchandise Sponsor": Package,
  "Flag Sponsor": Flag,
  "Dinner Sponsor": Utensils,
  "Scorecard Sponsor": CreditCard,
  "Golf Cart Sponsor": ShoppingCart,
  "Hydration Hero": Droplets,
  "Hole Sponsor": Flag,
  "Bunker Buddy": Heart,
  "50/50 Sponsor": Trophy,
  "Caddie": Gift,
  "Fairway Friend": Heart,
  "Prize Patrol": Award,
};

interface Tier { id: string; name: string; price: number; benefits: string[]; sort_order: number; max_slots: number | null; }
interface Sponsor { id: string; business_name: string; tier_name: string; logo_url: string | null; }

const SponsorPage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const tiersRes = await supabase.from("sponsorship_tiers").select("*").eq("active", true).order("sort_order");
        if (tiersRes.error) {
          setFetchError(tiersRes.error.message);
        } else if (tiersRes.data) {
          const mapped = tiersRes.data.map((t: any) => ({ ...t, benefits: t.benefits as string[], max_slots: t.max_slots }));
          setTiers(mapped);
        }
      } catch (e) {
        setFetchError(String(e));
      }
      try {
        const sponsorsRes = await supabase.from("sponsors_public" as any).select("id, business_name, tier_name, logo_url");
        if (sponsorsRes.data) setSponsors(sponsorsRes.data as any);
      } catch (e) {
        console.error("[Sponsor] Failed to load sponsors", e);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const isSoldOut = (tier: Tier) => tier.max_slots === 0;
  const isInKind = (tier: Tier) => tier.price === 0 && !isSoldOut(tier);

  const getPriceLabel = (tier: Tier) => {
    if (isSoldOut(tier)) return "SOLD OUT";
    if (isInKind(tier)) return "In-Kind";
    if (tier.name === "Fairway Friend") return `$${tier.price.toLocaleString()}+`;
    return `$${tier.price.toLocaleString()}`;
  };

  const handleSelect = (tier: Tier) => {
    addItem({
      type: "sponsorship",
      description: `${tier.name} Sponsorship`,
      amount: tier.price,
      formData: { tier: tier.name, tierId: tier.id },
    });
    toast({ title: `${tier.name} sponsorship added to cart!` });
    setDrawerOpen(true);
  };

  const premiumTiers = tiers.filter(t => t.sort_order <= 7);
  const standardTiers = tiers.filter(t => t.sort_order > 7);

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <img src={sponsorHero} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_25%] opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Partner With Us</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Become a Sponsor
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Support the tournament and make a meaningful impact in the fight against A-T.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Sponsorship Packages</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-4">
            Choose your level.
          </h2>
          <p className="text-[#1A1A1A]/50 mb-12 max-w-2xl">
            Number in brackets indicates available spots. All sponsorships include recognition and meaningful engagement opportunities.
          </p>

          {loading && <p className="text-[#1A1A1A]/60 py-8">Loading sponsorship packages...</p>}
          {fetchError && <p className="text-red-600 py-4">Error loading tiers: {fetchError}</p>}
          {!loading && !fetchError && tiers.length === 0 && <p className="text-[#1A1A1A]/60 py-8">No sponsorship tiers found.</p>}

          {/* Premium tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#1A1A1A]/10 mb-8">
            {premiumTiers.map((tier) => {
              const Icon = tierIcons[tier.name] || Flag;
              const soldOut = isSoldOut(tier);
              const inKind = isInKind(tier);
              return (
                <div key={tier.id} className={`bg-white p-8 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-4">
                    <Icon className="h-8 w-8 text-primary" />
                    {soldOut && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                    {tier.max_slots != null && tier.max_slots > 0 && (
                      <Badge variant="secondary" className="text-xs">{tier.max_slots} available</Badge>
                    )}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[#1A1A1A] mb-1">{tier.name}</h3>
                  <p className={`font-heading font-extrabold text-2xl mb-6 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                    {getPriceLabel(tier)}
                  </p>
                  <ul className="space-y-2 flex-1 mb-6">
                    {tier.benefits.map((b) => (
                      <li key={b} className="text-sm text-[#1A1A1A]/60 flex items-start gap-2 text-left">
                        <span className="text-primary mt-1">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm"
                    onClick={() => handleSelect(tier)}
                    disabled={soldOut}
                  >
                    {soldOut ? "Sold Out" : inKind ? "Add to Cart" : "Select"}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Standard tiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1A1A1A]/10">
            {standardTiers.map((tier) => {
              const Icon = tierIcons[tier.name] || Flag;
              const soldOut = isSoldOut(tier);
              const inKind = isInKind(tier);
              return (
                <div key={tier.id} className={`bg-white p-8 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between mb-4">
                    <Icon className="h-7 w-7 text-primary" />
                    {soldOut && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                    {tier.max_slots != null && tier.max_slots > 0 && (
                      <Badge variant="secondary" className="text-xs">{tier.max_slots} available</Badge>
                    )}
                    {tier.max_slots == null && !soldOut && (
                      <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                    )}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[#1A1A1A] mb-1">{tier.name}</h3>
                  <p className={`font-heading font-extrabold text-xl mb-4 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                    {getPriceLabel(tier)}
                  </p>
                  <ul className="space-y-2 flex-1 mb-6">
                    {tier.benefits.map((b) => (
                      <li key={b} className="text-sm text-[#1A1A1A]/60 flex items-start gap-2 text-left">
                        <span className="text-primary mt-1">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm"
                    onClick={() => handleSelect(tier)}
                    disabled={soldOut}
                  >
                    {soldOut ? "Sold Out" : inKind ? "Add to Cart" : "Select"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Current sponsors */}
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Current Sponsors</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white mb-12">
            Thank you to our partners.
          </h2>
          {sponsors.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {sponsors.map((s) => (
                <div key={s.id} className="bg-white/5 border border-white/10 p-6 rounded flex flex-col items-center gap-3">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.business_name} className="h-16 object-contain" />
                  ) : (
                    <div className="h-16 w-16 bg-white/10 rounded flex items-center justify-center text-lg font-heading font-bold text-white/30">{s.business_name.charAt(0)}</div>
                  )}
                  <p className="text-sm font-medium text-white">{s.business_name}</p>
                  <span className="text-xs text-white/40 font-heading uppercase tracking-wider">{s.tier_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 border border-dashed border-white/15 rounded text-center">
              <p className="text-white/40">Be our first sponsor.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SponsorPage;
