import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import registrationHero from "@/assets/registration-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Users, Clock, UtensilsCrossed, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RegistrationStatus = "coming_soon" | "open" | "sold_out";

const DINNER_PRICE = 45;
const TEAM_PRICE = 600;

const RegisterPage = () => {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus>("coming_soon");

  // Section toggles
  const [wantsTeam, setWantsTeam] = useState(false);
  const [wantsDinner, setWantsDinner] = useState(false);

  // Team form
  const [teamForm, setTeamForm] = useState({
    teamName: "", captainName: "", captainEmail: "", captainPhone: "",
    street: "", city: "", province: "", postalCode: "",
  });

  // Dinner form
  const [dinnerForm, setDinnerForm] = useState({ name: "", email: "", phone: "", quantity: 1 });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["registration_status", "spots_remaining"]);
      if (data) {
        for (const s of data) {
          if (s.key === "registration_status") {
            const val = typeof s.value === "string" ? s.value : String(s.value);
            if (["coming_soon", "open", "sold_out"].includes(val)) {
              setRegStatus(val as RegistrationStatus);
            }
          }
          if (s.key === "spots_remaining") setSpotsAvailable(Number(s.value));
        }
      }
    };
    fetchSettings();
  }, []);

  const handleTeamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTeamForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleDinnerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setDinnerForm((prev) => ({ ...prev, [name]: type === "number" ? Math.max(1, Number(value)) : value }));
  };

  const dinnerTotal = dinnerForm.quantity * DINNER_PRICE;
  const cartTotal = (wantsTeam ? TEAM_PRICE : 0) + (wantsDinner ? dinnerTotal : 0);

  const handleAddAllToCart = (e: React.FormEvent) => {
    e.preventDefault();

    if (!wantsTeam && !wantsDinner) {
      toast({ title: "Nothing selected", description: "Please select at least one option.", variant: "destructive" });
      return;
    }

    if (wantsTeam) {
      addItem({
        type: "registration",
        description: `Team Registration: ${teamForm.teamName}`,
        amount: TEAM_PRICE,
        formData: { ...teamForm },
      });
    }

    if (wantsDinner) {
      addItem({
        type: "dinner",
        description: `Dinner Tickets x ${dinnerForm.quantity}: ${dinnerForm.name}`,
        amount: dinnerTotal,
        formData: { guestName: dinnerForm.name, guestEmail: dinnerForm.email, guestPhone: dinnerForm.phone, quantity: dinnerForm.quantity },
      });
    }

    setSubmitted(true);
    const items = [wantsTeam && "team registration", wantsDinner && "dinner tickets"].filter(Boolean).join(" and ");
    toast({ title: `Added ${items} to cart!` });
  };

  // Waitlist form (shared by coming_soon + sold_out)
  const [waitlistForm, setWaitlistForm] = useState({ name: "", email: "", phone: "", teamName: "" });
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const handleWaitlistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWaitlistForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("waitlist").insert({
      name: waitlistForm.name,
      email: waitlistForm.email,
      phone: waitlistForm.phone,
      team_name: waitlistForm.teamName,
    });
    if (error) {
      toast({ title: "Error", description: "Could not submit waitlist form. Please try again.", variant: "destructive" });
      return;
    }
    setWaitlistSubmitted(true);
    toast({ title: "You've been added to the waitlist!" });
  };

  // Coming Soon state
  if (regStatus === "coming_soon") {
    return (
      <div>
        <section className="section-dark relative overflow-hidden">
          <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="container py-20 md:py-28 text-center animate-fade-in relative z-10">
            <Clock className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white mb-4">Coming Soon</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Team registration for the Hope 4 Holden Golf Tournament will be opening soon. Leave your details below and we'll notify you when registration opens!
            </p>
          </div>
        </section>
        <section className="section-light">
          <div className="container py-16 md:py-20 max-w-xl animate-fade-in">
            {waitlistSubmitted ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto" />
                <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Thanks for Your Interest!</h2>
                <p className="text-[#1A1A1A]/60">We'll contact you when registration opens.</p>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-4 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
                <h2 className="font-heading font-bold text-xl text-[#1A1A1A] mb-2">Get Notified When Registration Opens</h2>
                <div className="space-y-2">
                  <Label htmlFor="cs-name" className="text-[#1A1A1A] font-medium">Full Name</Label>
                  <Input id="cs-name" name="name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cs-email" className="text-[#1A1A1A] font-medium">Email</Label>
                  <Input id="cs-email" name="email" type="email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cs-phone" className="text-[#1A1A1A] font-medium">Phone</Label>
                  <Input id="cs-phone" name="phone" type="tel" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cs-teamName" className="text-[#1A1A1A] font-medium">Team Name</Label>
                  <Input id="cs-teamName" name="teamName" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
                  Notify Me
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Sold Out state
  if (regStatus === "sold_out") {
    return (
      <div>
        <section className="section-dark relative overflow-hidden">
          <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="container py-20 md:py-28 text-center animate-fade-in relative z-10">
            <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white mb-4">Sold Out</h1>
            <p className="text-white/60 text-lg mb-8">All spots have been filled. Join the waitlist below.</p>
          </div>
        </section>
        <section className="section-light">
          <div className="container py-16 md:py-20 max-w-xl animate-fade-in">
            {waitlistSubmitted ? (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-primary mx-auto" />
                <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">You're on the List!</h2>
                <p className="text-[#1A1A1A]/60">We'll contact you if a spot opens up.</p>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-4 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
                <h2 className="font-heading font-bold text-xl text-[#1A1A1A] mb-2">Join the Waitlist</h2>
                <div className="space-y-2">
                  <Label htmlFor="wl-name" className="text-[#1A1A1A] font-medium">Full Name</Label>
                  <Input id="wl-name" name="name" value={waitlistForm.name} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-email" className="text-[#1A1A1A] font-medium">Email</Label>
                  <Input id="wl-email" name="email" type="email" value={waitlistForm.email} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-phone" className="text-[#1A1A1A] font-medium">Phone</Label>
                  <Input id="wl-phone" name="phone" type="tel" value={waitlistForm.phone} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wl-teamName" className="text-[#1A1A1A] font-medium">Team Name</Label>
                  <Input id="wl-teamName" name="teamName" value={waitlistForm.teamName} onChange={handleWaitlistChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
                  Join Waitlist
                </Button>
              </form>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Submitted confirmation
  if (submitted) {
    return (
      <div className="section-light">
        <div className="container py-20 text-center space-y-6 animate-fade-in">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Added to Cart!</h2>
          <p className="text-[#1A1A1A]/60">Your selections have been added to your cart.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#1A1A1A]/5" onClick={() => {
              setSubmitted(false);
              setWantsTeam(false);
              setWantsDinner(false);
              setTeamForm({ teamName: "", captainName: "", captainEmail: "", captainPhone: "", street: "", city: "", province: "", postalCode: "" });
              setDinnerForm({ name: "", email: "", phone: "", quantity: 1 });
            }}>
              Continue Shopping
            </Button>
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => navigate("/checkout")}>Go to Checkout</Button>
          </div>
        </div>
      </div>
    );
  }

  // Open — unified form
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Join Us</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Join Us
          </h1>
          <p className="text-white/60 text-lg">Register your team, grab dinner tickets, or both — add everything to your cart at once.</p>
          {spotsAvailable !== null && (
            <div className="flex items-center gap-2 text-primary font-heading font-bold mt-4">
              <Users className="h-5 w-5" />
              <span>{spotsAvailable} spots remaining</span>
            </div>
          )}
        </div>
      </section>

      <form onSubmit={handleAddAllToCart}>
        {/* Section 1: Team Registration */}
        <section className="section-light">
          <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
            <div className="flex items-start gap-3 mb-6">
              <Checkbox
                id="wants-team"
                checked={wantsTeam}
                onCheckedChange={(checked) => setWantsTeam(checked === true)}
                className="mt-1 h-5 w-5"
              />
              <div>
                <label htmlFor="wants-team" className="cursor-pointer">
                  <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A]">Register Your Team</h2>
                  <p className="text-[#1A1A1A]/60">$600 per team of 4 golfers</p>
                </label>
              </div>
            </div>

            {wantsTeam && (
              <>
                <p className="text-sm text-primary font-medium bg-primary/10 border border-primary/20 rounded px-4 py-3 mb-6">
                  Team registration includes dinner on Thursday evening for all 4 golfers.
                </p>
                <div className="space-y-6 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
                  <div>
                    <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Team Details</p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="teamName" className="text-[#1A1A1A] font-medium">Business / Team Name</Label>
                        <Input id="teamName" name="teamName" value={teamForm.teamName} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="captainName" className="text-[#1A1A1A] font-medium">Captain Full Name</Label>
                          <Input id="captainName" name="captainName" value={teamForm.captainName} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="captainEmail" className="text-[#1A1A1A] font-medium">Email</Label>
                          <Input id="captainEmail" name="captainEmail" type="email" value={teamForm.captainEmail} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="captainPhone" className="text-[#1A1A1A] font-medium">Phone</Label>
                        <Input id="captainPhone" name="captainPhone" type="tel" value={teamForm.captainPhone} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Mailing Address</p>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="street" className="text-[#1A1A1A] font-medium">Street Address</Label>
                        <Input id="street" name="street" value={teamForm.street} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city" className="text-[#1A1A1A] font-medium">City</Label>
                          <Input id="city" name="city" value={teamForm.city} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="province" className="text-[#1A1A1A] font-medium">Province</Label>
                          <Input id="province" name="province" value={teamForm.province} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="postalCode" className="text-[#1A1A1A] font-medium">Postal Code</Label>
                          <Input id="postalCode" name="postalCode" value={teamForm.postalCode} onChange={handleTeamChange} required className="rounded border-[#1A1A1A]/15" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Separator */}
        <div className="container max-w-2xl">
          <hr className="border-[#1A1A1A]/10" />
        </div>

        {/* Section 2: Dinner Only */}
        <section className="bg-[#F8F6F3]">
          <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
            <div className="flex items-start gap-3 mb-6">
              <Checkbox
                id="wants-dinner"
                checked={wantsDinner}
                onCheckedChange={(checked) => setWantsDinner(checked === true)}
                className="mt-1 h-5 w-5"
              />
              <div>
                <label htmlFor="wants-dinner" className="cursor-pointer">
                  <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A]">Dinner Only</h2>
                  <p className="text-[#1A1A1A]/60">$45 per person — join us for the Thursday evening dinner without golfing</p>
                </label>
              </div>
            </div>

            {wantsDinner && (
              <div className="space-y-6 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Guest Details</p>
                  </div>
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="d-name" className="text-[#1A1A1A] font-medium">Full Name</Label>
                      <Input id="d-name" name="name" value={dinnerForm.name} onChange={handleDinnerChange} required className="rounded border-[#1A1A1A]/15" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="d-email" className="text-[#1A1A1A] font-medium">Email</Label>
                        <Input id="d-email" name="email" type="email" value={dinnerForm.email} onChange={handleDinnerChange} required className="rounded border-[#1A1A1A]/15" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="d-phone" className="text-[#1A1A1A] font-medium">Phone</Label>
                        <Input id="d-phone" name="phone" type="tel" value={dinnerForm.phone} onChange={handleDinnerChange} required className="rounded border-[#1A1A1A]/15" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="d-quantity" className="text-[#1A1A1A] font-medium">Number of Tickets</Label>
                      <Input id="d-quantity" name="quantity" type="number" min={1} value={dinnerForm.quantity} onChange={handleDinnerChange} required className="rounded border-[#1A1A1A]/15 w-32" />
                    </div>
                    <p className="text-[#1A1A1A]/60 font-medium">
                      {dinnerForm.quantity} ticket{dinnerForm.quantity !== 1 ? "s" : ""} × ${DINNER_PRICE} = <span className="text-[#1A1A1A] font-bold">${dinnerTotal}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sticky Add to Cart bar */}
        {(wantsTeam || wantsDinner) && (
          <div className="sticky bottom-0 z-30 bg-[#1A1A1A] border-t border-white/10 shadow-lg">
            <div className="container max-w-2xl py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-white text-sm">
                <span className="text-white/60">Your selections: </span>
                {[wantsTeam && `Team ($${TEAM_PRICE})`, wantsDinner && `Dinner ($${dinnerTotal})`].filter(Boolean).join(" + ")}
              </div>
              <Button type="submit" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider px-8" size="lg">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart — ${cartTotal}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default RegisterPage;
