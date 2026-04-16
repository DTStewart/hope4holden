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
const REGISTRATION_STATUS_VALUES: RegistrationStatus[] = ["coming_soon", "open", "sold_out"];

const parseRegistrationStatus = (value: unknown): RegistrationStatus => {
  if (typeof value === "string") {
    const normalized = value.replace(/^"|"$/g, "").trim().toLowerCase();
    if (REGISTRATION_STATUS_VALUES.includes(normalized as RegistrationStatus)) {
      return normalized as RegistrationStatus;
    }
  }

  if (value && typeof value === "object" && "status" in value) {
    return parseRegistrationStatus((value as { status?: unknown }).status);
  }

  return "coming_soon";
};

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

const overviewCards = [
  { anchor: "#register", icon: Users, title: "Register Your Team", price: "$600", desc: "Dinner + golf for 4" },
  { anchor: "#dinner", icon: UtensilsCrossed, title: "Dinner Only", price: "$45/ticket", desc: "Thursday evening at the Victoria Inn" },
  { anchor: "#sponsor", icon: Star, title: "Become a Sponsor", price: "From $150", desc: "Put your brand front and center" },
  { anchor: "#donate", icon: Heart, title: "Make a Donation", price: "Any amount", desc: "Every dollar funds A-T research" },
];

const ParticipatePage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus>("coming_soon");
  const [dinnerQty, setDinnerQty] = useState(1);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [wantsRecurring, setWantsRecurring] = useState(false);
  const donationAmount = isCustom ? Number(customAmount) : selectedAmount;

  const [waitlistForm, setWaitlistForm] = useState({ name: "", email: "", phone: "", teamName: "" });
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["registration_status", "spots_remaining"]);
      if (settings) {
        for (const s of settings) {
          if (s.key === "registration_status") {
            console.log("[Register] raw registration_status value:", JSON.stringify(s.value), "typeof:", typeof s.value);
            const parsed = parseRegistrationStatus(s.value);
            console.log("[Register] parsed registration_status:", parsed);
            setRegStatus(parsed);
          }
          if (s.key === "spots_remaining") setSpotsAvailable(Number(s.value));
        }
      }
      setTiersLoading(true);
      const { data: tiersData } = await supabase.from("sponsorship_tiers").select("*").eq("active", true).order("sort_order");
      if (tiersData) {
        setTiers(tiersData.map((t: any) => ({ ...t, benefits: t.benefits as string[], max_slots: t.max_slots })));
      }
      setTiersLoading(false);
    };
    fetchData();
  }, []);

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
      {/* Hero — compact */}
      <section className="section-dark relative overflow-hidden">
        <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-14 md:py-20 animate-fade-in relative z-10">
          <p className="section-label">Get Involved</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-5xl text-white leading-[0.95] mb-3">
            Participate
          </h1>
          <p className="text-white/60 text-base max-w-xl">
            Register a team, grab dinner tickets, become a sponsor, or donate — every contribution helps fight A-T.
          </p>
        </div>
      </section>

      {/* ─── Overview Cards ─── */}
      <section className="bg-white border-b border-[#1A1A1A]/10">
        <div className="container py-6 md:py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.anchor}
                  href={card.anchor}
                  className="group border border-[#1A1A1A]/10 rounded p-4 md:p-5 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors"
                >
                  <Icon className="h-5 w-5 text-primary mb-2" />
                  <h3 className="font-heading font-bold text-sm md:text-base text-[#1A1A1A] leading-tight">{card.title}</h3>
                  <p className="font-heading font-extrabold text-primary text-sm md:text-lg">{card.price}</p>
                  <p className="text-[#1A1A1A]/50 text-xs mt-1 leading-snug">{card.desc}</p>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Register + Dinner side by side ─── */}
      <section className="section-light">
        <div className="container py-10 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Register */}
            <div id="register" className="bg-white p-6 border border-[#1A1A1A]/10 rounded scroll-mt-24">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-heading font-bold text-lg text-[#1A1A1A]">Register Your Team</h2>
              </div>
              <p className="text-[#1A1A1A]/50 text-sm mb-4">$600 — Dinner Thursday + golf Friday for 4 golfers.</p>

              {regStatus === "open" && (
                <div className="space-y-3">
                  {spotsAvailable !== null && (
                    <p className="text-primary font-heading font-bold text-xs flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {spotsAvailable} spots remaining
                    </p>
                  )}
                  <Button onClick={handleAddTeam} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm" size="default">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart — $600
                  </Button>
                </div>
              )}

              {regStatus === "coming_soon" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#1A1A1A]/60 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-heading font-bold">Registration opens soon</span>
                  </div>
                  {waitlistSubmitted ? (
                    <div className="flex items-center gap-2 text-primary text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">You're on the list!</span>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="space-y-2">
                      <p className="text-xs text-[#1A1A1A]/50">Leave your details — we'll notify you.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input name="name" placeholder="Full Name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="email" type="email" placeholder="Email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="phone" type="tel" placeholder="Phone" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="teamName" placeholder="Team Name" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                      </div>
                      <Button type="submit" size="sm" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-xs">
                        Notify Me
                      </Button>
                    </form>
                  )}
                </div>
              )}

              {regStatus === "sold_out" && (
                <div className="space-y-3">
                  <Badge variant="destructive" className="text-xs">Sold Out</Badge>
                  {waitlistSubmitted ? (
                    <div className="flex items-center gap-2 text-primary text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">You're on the waitlist!</span>
                    </div>
                  ) : (
                    <form onSubmit={handleWaitlistSubmit} className="space-y-2">
                      <p className="text-xs text-[#1A1A1A]/50">All spots filled. Join the waitlist.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input name="name" placeholder="Full Name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="email" type="email" placeholder="Email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="phone" type="tel" placeholder="Phone" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                        <Input name="teamName" placeholder="Team Name" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15 text-sm" />
                      </div>
                      <Button type="submit" size="sm" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-xs">
                        Join Waitlist
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Dinner */}
            <div id="dinner" className="bg-white p-6 border border-[#1A1A1A]/10 rounded scroll-mt-24">
              <div className="flex items-center gap-2 mb-1">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                <h2 className="font-heading font-bold text-lg text-[#1A1A1A]">Dinner Only</h2>
              </div>
              <p className="text-[#1A1A1A]/50 text-sm mb-4">$45/person — Thursday evening at the Victoria Inn.</p>

              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label htmlFor="dinnerQty" className="text-[#1A1A1A] font-medium text-sm">Tickets</Label>
                  <Input
                    id="dinnerQty"
                    type="number"
                    min={1}
                    value={dinnerQty}
                    onChange={(e) => setDinnerQty(Math.max(1, Number(e.target.value)))}
                    className="rounded border-[#1A1A1A]/15 w-20 text-sm"
                  />
                </div>
                <span className="text-[#1A1A1A]/50 text-sm pb-1">
                  {dinnerQty} × ${DINNER_PRICE} = <span className="text-[#1A1A1A] font-bold">${dinnerQty * DINNER_PRICE}</span>
                </span>
                <Button onClick={handleAddDinner} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm" size="default">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Sponsorship ─── */}
      <section id="sponsor" className="bg-[#F8F6F3] scroll-mt-24">
        <div className="container py-10 md:py-12 animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-bold text-lg md:text-xl text-[#1A1A1A]">Become a Sponsor</h2>
          </div>
          <p className="text-[#1A1A1A]/50 text-sm mb-6 max-w-xl">
            Support the tournament and make a meaningful impact. All sponsorships include recognition and engagement opportunities.
          </p>

          {tiersLoading && <p className="text-[#1A1A1A]/60 text-sm py-4">Loading sponsorship packages...</p>}

          {premiumTiers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#1A1A1A]/10 mb-4">
              {premiumTiers.map((tier) => {
                const Icon = tierIcons[tier.name] || Flag;
                const soldOut = isSoldOut(tier);
                return (
                  <div key={tier.id} className={`bg-white p-5 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-2">
                      <Icon className="h-6 w-6 text-primary" />
                      {soldOut && <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>}
                      {tier.max_slots != null && tier.max_slots > 0 && <Badge variant="secondary" className="text-[10px]">{tier.max_slots} avail</Badge>}
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#1A1A1A] mb-0.5">{tier.name}</h3>
                    <p className={`font-heading font-extrabold text-xl mb-3 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                      {getPriceLabel(tier)}
                    </p>
                    <ul className="space-y-1 flex-1 mb-4">
                      {tier.benefits.map((b) => (
                        <li key={b} className="text-xs text-[#1A1A1A]/60 flex items-start gap-1.5 text-left">
                          <span className="text-primary mt-0.5">·</span>{b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-xs"
                      size="sm"
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

          {standardTiers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1A1A1A]/10">
              {standardTiers.map((tier) => {
                const Icon = tierIcons[tier.name] || Flag;
                const soldOut = isSoldOut(tier);
                return (
                  <div key={tier.id} className={`bg-white p-5 flex flex-col ${soldOut ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      {soldOut && <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>}
                      {tier.max_slots != null && tier.max_slots > 0 && <Badge variant="secondary" className="text-[10px]">{tier.max_slots} avail</Badge>}
                      {tier.max_slots == null && !soldOut && <Badge variant="secondary" className="text-[10px]">Unlimited</Badge>}
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#1A1A1A] mb-0.5">{tier.name}</h3>
                    <p className={`font-heading font-extrabold text-lg mb-3 ${soldOut ? "text-[#1A1A1A]/40 line-through" : "text-primary"}`}>
                      {getPriceLabel(tier)}
                    </p>
                    <ul className="space-y-1 flex-1 mb-4">
                      {tier.benefits.map((b) => (
                        <li key={b} className="text-xs text-[#1A1A1A]/60 flex items-start gap-1.5 text-left">
                          <span className="text-primary mt-0.5">·</span>{b}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-xs"
                      size="sm"
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

      {/* ─── Donation ─── */}
      <section id="donate" className="section-light scroll-mt-24">
        <div className="container py-10 md:py-12 max-w-2xl animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-5 w-5 text-primary" />
            <h2 className="font-heading font-bold text-lg md:text-xl text-[#1A1A1A]">Make a Donation</h2>
          </div>
          <p className="text-[#1A1A1A]/50 text-sm mb-4">Every dollar helps fund research for a cure for Ataxia Telangiectasia.</p>

          <div className="bg-white p-6 border border-[#1A1A1A]/10 rounded space-y-4">
            <div className="flex items-center gap-3">
              <img src={atcpLogo} alt="A-T Children's Project logo" className="h-7 w-auto" />
              <p className="text-xs text-[#1A1A1A]/50">Tax receipts issued by the ATCP.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A] font-medium text-sm">Select Amount</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {suggestedAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                    className={`py-2 rounded text-sm font-heading font-bold transition-colors ${
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
                  className={`py-2 rounded text-sm font-heading font-bold transition-colors ${
                    isCustom ? "bg-primary text-white" : "bg-[#1A1A1A]/5 text-[#1A1A1A] hover:bg-[#1A1A1A]/10"
                  }`}
                >
                  Other
                </button>
              </div>
              {isCustom && (
                <Input type="number" min="1" step="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Enter amount" className="rounded border-[#1A1A1A]/15 w-40 text-sm" />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox id="recurring" checked={wantsRecurring} onCheckedChange={(checked) => setWantsRecurring(!!checked)} />
                <Label htmlFor="recurring" className="text-xs cursor-pointer text-[#1A1A1A]/70">
                  I'd like to set up a recurring donation
                </Label>
              </div>
              {wantsRecurring && (
                <p className="text-xs text-[#1A1A1A]/50 bg-[#1A1A1A]/[0.03] border border-[#1A1A1A]/10 rounded px-3 py-2">
                  After you complete your purchase, we'll provide a link to the{" "}
                  <a href="https://atcp.org/ways-to-give/support-a-tcp-canada/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    ATCP website
                  </a>{" "}
                  where you can set up a recurring donation directly with them.
                </p>
              )}
              <div className="flex justify-end">
                <Button onClick={handleAddDonation} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider text-sm" size="default">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add to Cart — ${donationAmount || 0}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ParticipatePage;
