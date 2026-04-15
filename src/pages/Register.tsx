import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import registrationHero from "@/assets/registration-hero.jpg";
import atcpLogo from "@/assets/atcp-logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle, Users, Clock, UtensilsCrossed, ShoppingCart,
  Star, Award, Flag, Utensils, CreditCard, Droplets, Gift, Heart, Trophy, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RegistrationStatus = "coming_soon" | "open" | "sold_out";

const DINNER_PRICE = 45;
const TEAM_PRICE = 600;

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

const suggestedAmounts = [25, 50, 100, 250, 500];

const ParticipatePage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  // Registration state
  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus>("open");

  // Dinner state
  const [dinnerQty, setDinnerQty] = useState(1);

  // Sponsor state
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);

  // Donate state
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [wantsRecurring, setWantsRecurring] = useState(false);
  const donationAmount = isCustom ? Number(customAmount) : selectedAmount;

  // Waitlist (for coming_soon / sold_out)
  const [waitlistForm, setWaitlistForm] = useState({ name: "", email: "", phone: "", teamName: "" });
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Settings
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["registration_status", "spots_remaining"]);
      if (settings) {
        for (const s of settings) {
          if (s.key === "registration_status") {
            const val = typeof s.value === "string" ? s.value : String(s.value);
            if (["coming_soon", "open", "sold_out"].includes(val)) setRegStatus(val as RegistrationStatus);
          }
          if (s.key === "spots_remaining") setSpotsAvailable(Number(s.value));
        }
      }
      // Sponsorship tiers
      setTiersLoading(true);
      const { data: tiersData } = await supabase.from("sponsorship_tiers").select("*").eq("active", true).order("sort_order");
      if (tiersData) {
        setTiers(tiersData.map((t: any) => ({ ...t, benefits: t.benefits as string[], max_slots: t.max_slots })));
      }
      setTiersLoading(false);
    };
    fetchData();
  }, []);

  // Handlers
  const handleAddTeam = () => {
    addItem({ type: "registration", description: "Team Registration (4 golfers)", amount: TEAM_PRICE, formData: {} });
    toast({ title: "Team registration added to cart!" });
    setDrawerOpen(true);
  };

  const handleAddDinner = () => {
    addItem({ type: "dinner", description: `Dinner Tickets × ${dinnerQty}`, amount: dinnerQty * DINNER_PRICE, formData: { quantity: dinnerQty } });
    toast({ title: `${dinnerQty} dinner ticket${dinnerQty > 1 ? "s" : ""} added to cart!` });
    setDrawerOpen(true);
  };

  const handleSelectTier = (tier: Tier) => {
    addItem({ type: "sponsorship", description: `${tier.name} Sponsorship`, amount: tier.price, formData: { tier: tier.name, tierId: tier.id } });
    toast({ title: `${tier.name} sponsorship added to cart!` });
    setDrawerOpen(true);
  };

  const handleAddDonation = () => {
    if (!donationAmount || donationAmount <= 0) {
      toast({ title: "Please enter a valid donation amount", variant: "destructive" });
      return;
    }
    addItem({ type: "donation", description: `Donation: $${donationAmount}`, amount: donationAmount, formData: { amount: donationAmount, wantsRecurring } });
    toast({ title: "Donation added to cart!" });
    setDrawerOpen(true);
  };

  const handleWaitlistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWaitlistForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("waitlist").insert({
      name: waitlistForm.name, email: waitlistForm.email, phone: waitlistForm.phone, team_name: waitlistForm.teamName,
    });
    if (error) {
      toast({ title: "Error", description: "Could not submit. Please try again.", variant: "destructive" });
      return;
    }
    setWaitlistSubmitted(true);
    toast({ title: "You've been added to the waitlist!" });
  };

  const isSoldOut = (tier: Tier) => tier.max_slots === 0;
  const isInKind = (tier: Tier) => tier.price === 0 && !isSoldOut(tier);
  const getPriceLabel = (tier: Tier) => {
    if (isSoldOut(tier)) return "SOLD OUT";
    if (isInKind(tier)) return "In-Kind";
    if (tier.name === "Fairway Friend") return `$${tier.price.toLocaleString()}+`;
    return `$${tier.price.toLocaleString()}`;
  };

  const premiumTiers = tiers.filter(t => t.sort_order <= 7);
  const standardTiers = tiers.filter(t => t.sort_order > 7);

  return (
    <div>
      {/* Hero */}
      <section className="section-dark relative overflow-hidden">
        <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Get Involved</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Participate
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Register a team, grab dinner tickets, become a sponsor, or make a donation — every contribution helps in the fight against A-T.
          </p>
        </div>
      </section>

      {/* ─── Section 1: Register Your Team ─── */}
      <section id="register" className="section-light">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-7 w-7 text-primary" />
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A]">Register Your Team</h2>
          </div>
          <p className="text-[#1A1A1A]/60 mb-6">$600 — Includes dinner Thursday and golf Friday for 4 golfers.</p>

          {regStatus === "open" && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              {spotsAvailable !== null && (
                <div className="flex items-center gap-2 text-primary font-heading font-bold text-sm">
                  <Users className="h-4 w-4" />
                  <span>{spotsAvailable} spots remaining</span>
                </div>
              )}
              <Button onClick={handleAddTeam} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart — $600
              </Button>
            </div>
          )}

          {regStatus === "coming_soon" && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              <div className="flex items-center gap-2 text-[#1A1A1A]/60">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-heading font-bold">Registration opens soon</span>
              </div>
              {waitlistSubmitted ? (
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">You're on the list! We'll notify you.</span>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="space-y-3">
                  <p className="text-sm text-[#1A1A1A]/50">Leave your details and we'll notify you when registration opens.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input name="name" placeholder="Full Name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="email" type="email" placeholder="Email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="phone" type="tel" placeholder="Phone" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="teamName" placeholder="Team Name" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <Button type="submit" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
                    Notify Me
                  </Button>
                </form>
              )}
            </div>
          )}

          {regStatus === "sold_out" && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              <Badge variant="destructive" className="text-sm">Sold Out</Badge>
              {waitlistSubmitted ? (
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">You're on the waitlist!</span>
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="space-y-3">
                  <p className="text-sm text-[#1A1A1A]/50">All spots are filled. Join the waitlist below.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input name="name" placeholder="Full Name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="email" type="email" placeholder="Email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="phone" type="tel" placeholder="Phone" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                    <Input name="teamName" placeholder="Team Name" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <Button type="submit" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
                    Join Waitlist
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── Section 2: Dinner Only ─── */}
      <section id="dinner" className="bg-[#F8F6F3]">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A]">Dinner Only</h2>
          </div>
          <p className="text-[#1A1A1A]/60 mb-6">$45 per person — Join us for the Thursday evening dinner at the Victoria Inn.</p>

          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded">
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="dinnerQty" className="text-[#1A1A1A] font-medium">Tickets</Label>
                <Input
                  id="dinnerQty"
                  type="number"
                  min={1}
                  value={dinnerQty}
                  onChange={(e) => setDinnerQty(Math.max(1, Number(e.target.value)))}
                  className="rounded border-[#1A1A1A]/15 w-24"
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[#1A1A1A]/60 font-medium text-sm whitespace-nowrap">
                  {dinnerQty} × ${DINNER_PRICE} = <span className="text-[#1A1A1A] font-bold">${dinnerQty * DINNER_PRICE}</span>
                </span>
                <Button onClick={handleAddDinner} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Become a Sponsor ─── */}
      <section id="sponsor" className="section-light">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Partner With Us</p>
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-4">
            Become a Sponsor
          </h2>
          <p className="text-[#1A1A1A]/50 mb-12 max-w-2xl">
            Support the tournament and make a meaningful impact. All sponsorships include recognition and engagement opportunities.
          </p>

          {tiersLoading && <p className="text-[#1A1A1A]/60 py-8">Loading sponsorship packages...</p>}

          {/* Premium tiers */}
          {premiumTiers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#1A1A1A]/10 mb-8">
              {premiumTiers.map((tier) => {
                const Icon = tierIcons[tier.name] || Flag;
                const soldOut = isSoldOut(tier);
                return (
                  <div key={tier.id} className={`bg-white p-8 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="h-8 w-8 text-primary" />
                      {soldOut && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                      {tier.max_slots != null && tier.max_slots > 0 && <Badge variant="secondary" className="text-xs">{tier.max_slots} available</Badge>}
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#1A1A1A] mb-1">{tier.name}</h3>
                    <p className={`font-heading font-extrabold text-2xl mb-6 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                      {getPriceLabel(tier)}
                    </p>
                    <ul className="space-y-2 flex-1 mb-6">
                      {tier.benefits.map((b) => (
                        <li key={b} className="text-sm text-[#1A1A1A]/60 flex items-start gap-2 text-left">
                          <span className="text-primary mt-1">·</span>{b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm"
                      onClick={() => handleSelectTier(tier)}
                      disabled={soldOut}
                    >
                      {soldOut ? "Sold Out" : "Select"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard tiers */}
          {standardTiers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1A1A1A]/10">
              {standardTiers.map((tier) => {
                const Icon = tierIcons[tier.name] || Flag;
                const soldOut = isSoldOut(tier);
                return (
                  <div key={tier.id} className={`bg-white p-8 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-4">
                      <Icon className="h-7 w-7 text-primary" />
                      {soldOut && <Badge variant="destructive" className="text-xs">Sold Out</Badge>}
                      {tier.max_slots != null && tier.max_slots > 0 && <Badge variant="secondary" className="text-xs">{tier.max_slots} available</Badge>}
                      {tier.max_slots == null && !soldOut && <Badge variant="secondary" className="text-xs">Unlimited</Badge>}
                    </div>
                    <h3 className="font-heading font-bold text-lg text-[#1A1A1A] mb-1">{tier.name}</h3>
                    <p className={`font-heading font-extrabold text-xl mb-4 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                      {getPriceLabel(tier)}
                    </p>
                    <ul className="space-y-2 flex-1 mb-6">
                      {tier.benefits.map((b) => (
                        <li key={b} className="text-sm text-[#1A1A1A]/60 flex items-start gap-2 text-left">
                          <span className="text-primary mt-1">·</span>{b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm"
                      onClick={() => handleSelectTier(tier)}
                      disabled={soldOut}
                    >
                      {soldOut ? "Sold Out" : isInKind(tier) ? "Add to Cart" : "Select"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── Section 4: Make a Donation ─── */}
      <section id="donate" className="bg-[#F8F6F3]">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-7 w-7 text-primary" />
            <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A]">Make a Donation</h2>
          </div>
          <p className="text-[#1A1A1A]/60 mb-6">Every dollar helps fund research for a cure for Ataxia Telangiectasia.</p>

          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-6">
            <div className="flex items-center gap-3">
              <img src={atcpLogo} alt="A-T Children's Project logo" className="h-8 w-auto" />
              <p className="text-xs text-[#1A1A1A]/50">Tax receipts issued by the ATCP.</p>
            </div>

            {/* Amount selection */}
            <div className="space-y-3">
              <Label className="text-[#1A1A1A] font-medium">Select Amount</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {suggestedAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                    className={`py-2.5 rounded text-sm font-heading font-bold transition-colors ${
                      !isCustom && selectedAmount === amt
                        ? "bg-primary text-white"
                        : "bg-[#1A1A1A]/5 text-[#1A1A1A] hover:bg-[#1A1A1A]/10"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={`py-2.5 rounded text-sm font-heading font-bold transition-colors ${
                    isCustom ? "bg-primary text-white" : "bg-[#1A1A1A]/5 text-[#1A1A1A] hover:bg-[#1A1A1A]/10"
                  }`}
                >
                  Other
                </button>
              </div>
              {isCustom && (
                <Input type="number" min="1" step="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Enter amount" className="rounded border-[#1A1A1A]/15 w-40" />
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="recurring" checked={wantsRecurring} onCheckedChange={(checked) => setWantsRecurring(!!checked)} />
              <Label htmlFor="recurring" className="text-sm cursor-pointer text-[#1A1A1A]/70">
                I would like to set up a recurring donation
              </Label>
            </div>

            <Button onClick={handleAddDonation} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Cart — ${donationAmount || 0}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ParticipatePage;
