import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import registrationHero from "@/assets/registration-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Users, Clock, UtensilsCrossed, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RegistrationStatus = "coming_soon" | "open" | "sold_out";

const DINNER_PRICE = 45;
const TEAM_PRICE = 600;

const RegisterPage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const navigate = useNavigate();
  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus>("coming_soon");
  const [dinnerQty, setDinnerQty] = useState(1);

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

  // Open — simple selectors
  const handleAddTeam = () => {
    addItem({
      type: "registration",
      description: "Team Registration (4 golfers)",
      amount: TEAM_PRICE,
      formData: {},
    });
    toast({ title: "Team registration added to cart!" });
    setDrawerOpen(true);
  };

  const handleAddDinner = () => {
    const total = dinnerQty * DINNER_PRICE;
    addItem({
      type: "dinner",
      description: `Dinner Tickets × ${dinnerQty}`,
      amount: total,
      formData: { quantity: dinnerQty },
    });
    toast({ title: `${dinnerQty} dinner ticket${dinnerQty > 1 ? "s" : ""} added to cart!` });
    setDrawerOpen(true);
  };

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Join Us</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Join Us
          </h1>
          <p className="text-white/60 text-lg">Register your team, grab dinner tickets, or both.</p>
          {spotsAvailable !== null && (
            <div className="flex items-center gap-2 text-primary font-heading font-bold mt-4">
              <Users className="h-5 w-5" />
              <span>{spotsAvailable} spots remaining</span>
            </div>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in space-y-8">
          {/* Team Registration Card */}
          <div className="bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded space-y-4">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-primary" />
              <h2 className="font-heading font-extrabold text-2xl text-[#1A1A1A]">Register Your Team</h2>
            </div>
            <p className="text-[#1A1A1A]/60">$600 per team of 4 golfers. Includes dinner on Thursday evening for all 4 golfers.</p>
            <Button onClick={handleAddTeam} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add Team — $600
            </Button>
          </div>

          <hr className="border-[#1A1A1A]/10" />

          {/* Dinner Tickets Card */}
          <div className="bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded space-y-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-7 w-7 text-primary" />
              <h2 className="font-heading font-extrabold text-2xl text-[#1A1A1A]">Dinner Only</h2>
            </div>
            <p className="text-[#1A1A1A]/60">$45 per person — join us for the Thursday evening dinner without golfing.</p>
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
              <Button onClick={handleAddDinner} className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add — ${dinnerQty * DINNER_PRICE}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RegisterPage;
