import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Star, Award, Medal, Flag, ShoppingCart, Utensils, CreditCard, Droplets, Gift, Heart, Trophy, Package } from "lucide-react";
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
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ businessName: "", contactName: "", contactEmail: "", contactPhone: "" });

  useEffect(() => {
    const fetchData = async () => {
      const [tiersRes, sponsorsRes] = await Promise.all([
        supabase.from("sponsorship_tiers").select("*").eq("active", true).order("sort_order"),
        supabase.from("sponsors_public" as any).select("id, business_name, tier_name, logo_url"),
      ]);
      if (tiersRes.data) setTiers(tiersRes.data.map((t: any) => ({ ...t, benefits: t.benefits as string[], max_slots: t.max_slots })));
      if (sponsorsRes.data) setSponsors(sponsorsRes.data as any);
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isSoldOut = (tier: Tier) => tier.max_slots === 0;
  const isInKind = (tier: Tier) => tier.price === 0 && !isSoldOut(tier);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    addItem({
      type: "sponsorship",
      description: `${selectedTier.name}: ${form.businessName}`,
      amount: selectedTier.price,
      formData: { ...form, tier: selectedTier.name, tierId: selectedTier.id },
    });
    setSubmitted(true);
    setSelectedTier(null);
    toast({ title: "Sponsorship added to cart!" });
  };

  const handleInKindSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    // For in-kind / $0 tiers, add to cart with $0 amount
    addItem({
      type: "sponsorship",
      description: `${selectedTier.name}: ${form.businessName}`,
      amount: 0,
      formData: { ...form, tier: selectedTier.name, tierId: selectedTier.id },
    });
    setSubmitted(true);
    setSelectedTier(null);
    toast({ title: "Sponsorship request submitted!" });
  };

  const getPriceLabel = (tier: Tier) => {
    if (isSoldOut(tier)) return "SOLD OUT";
    if (isInKind(tier)) return "In-Kind";
    if (tier.name === "Fairway Friend") return `$${tier.price.toLocaleString()}+`;
    return `$${tier.price.toLocaleString()}`;
  };

  if (submitted) {
    return (
      <div className="section-light">
        <div className="container py-20 text-center space-y-6 animate-fade-in">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Sponsorship Added!</h2>
          <p className="text-[#1A1A1A]/60">Your sponsorship has been added to your cart.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A]" onClick={() => { setSubmitted(false); setForm({ businessName: "", contactName: "", contactEmail: "", contactPhone: "" }); }}>
              Continue Shopping
            </Button>
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => setDrawerOpen(true)}>Go to Cart</Button>
          </div>
        </div>
      </div>
    );
  }

  // Split tiers into premium (top row) and standard
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

      {/* Premium tier cards */}
      <section className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Sponsorship Packages</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-4">
            Choose your level.
          </h2>
          <p className="text-[#1A1A1A]/50 mb-12 max-w-2xl">
            Number in brackets indicates available spots. All sponsorships include recognition and meaningful engagement opportunities.
          </p>

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
                  <p className={`font-heading font-extrabold text-2xl mb-6 ${soldOut ? "text-[#1A1A1A]/40 line-through" : inKind ? "text-primary" : "text-primary"}`}>
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
                    onClick={() => !soldOut && setSelectedTier(tier)}
                    disabled={soldOut}
                  >
                    {soldOut ? "Sold Out" : "Select"}
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
                    onClick={() => !soldOut && setSelectedTier(tier)}
                    disabled={soldOut}
                  >
                    {soldOut ? "Sold Out" : inKind ? "Inquire" : "Select"}
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

      {/* Form dialog */}
      <Dialog open={!!selectedTier} onOpenChange={(open) => !open && setSelectedTier(null)}>
        <DialogContent className="rounded">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold">
              {selectedTier?.name}
              {selectedTier && !isInKind(selectedTier) && ` — $${selectedTier.price.toLocaleString()}`}
              {selectedTier && selectedTier.name === "Fairway Friend" && "+"}
            </DialogTitle>
            <DialogDescription>
              {selectedTier && isInKind(selectedTier)
                ? "Fill in your details and we'll be in touch to coordinate."
                : "Fill in your details to add this sponsorship to your cart."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={selectedTier && isInKind(selectedTier) ? handleInKindSubmit : handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required className="rounded" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} required className="rounded" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} required className="rounded" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input id="contactPhone" name="contactPhone" type="tel" value={form.contactPhone} onChange={handleChange} required className="rounded" />
            </div>
            <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold">
              {selectedTier && isInKind(selectedTier)
                ? "Submit Request"
                : `Add to Cart — $${selectedTier?.price.toLocaleString()}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SponsorPage;
