import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Star, Award, Medal, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const tierIcons: Record<string, any> = { Title: Star, Gold: Award, Silver: Medal, Hole: Flag };

interface Tier { id: string; name: string; price: number; benefits: string[]; sort_order: number; }
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
        supabase.from("sponsors").select("id, business_name, tier_name, logo_url").eq("approved", true),
      ]);
      if (tiersRes.data) setTiers(tiersRes.data.map((t: any) => ({ ...t, benefits: t.benefits as string[] })));
      if (sponsorsRes.data) setSponsors(sponsorsRes.data);
    };
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    addItem({
      type: "sponsorship",
      description: `${selectedTier.name} Sponsor: ${form.businessName}`,
      amount: selectedTier.price,
      formData: { ...form, tier: selectedTier.name, tierId: selectedTier.id },
    });
    setSubmitted(true);
    setSelectedTier(null);
    toast({ title: "Sponsorship added to cart!" });
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

  return (
    <div>
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Partner With Us</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Become a Sponsor
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Support the tournament and make a meaningful impact in the fight against A-T.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <section className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Sponsorship Tiers</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-12">
            Choose your level.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#1A1A1A]/10">
            {tiers.map((tier) => {
              const Icon = tierIcons[tier.name] || Flag;
              return (
                <div key={tier.name} className="bg-white p-8 flex flex-col">
                  <Icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-heading font-bold text-lg text-[#1A1A1A] mb-1">{tier.name}</h3>
                  <p className="font-heading font-extrabold text-2xl text-primary mb-6">${tier.price.toLocaleString()}</p>
                  <ul className="space-y-2 flex-1 mb-6">
                    {tier.benefits.map((b) => (
                      <li key={b} className="text-sm text-[#1A1A1A]/60 flex items-start gap-2 text-left">
                        <span className="text-primary mt-1">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm" onClick={() => setSelectedTier(tier)}>
                    Select
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
            <DialogTitle className="font-heading font-bold">{selectedTier?.name} — ${selectedTier?.price.toLocaleString()}</DialogTitle>
            <DialogDescription>Fill in your details to add this sponsorship to your cart.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              Add to Cart — ${selectedTier?.price.toLocaleString()}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SponsorPage;
