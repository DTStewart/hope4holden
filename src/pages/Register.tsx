import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import registrationHero from "@/assets/registration-hero.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Users, Clock, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RegistrationStatus = "coming_soon" | "open" | "sold_out";

const DINNER_PRICE = 45;

/* ─── Dinner-Only Form ─── */
const DinnerSection = () => {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", quantity: 1 });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "number" ? Math.max(1, Number(value)) : value }));
  };

  const total = form.quantity * DINNER_PRICE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addItem({
      type: "dinner",
      description: `Dinner Tickets x ${form.quantity}: ${form.name}`,
      amount: total,
      formData: { guestName: form.name, guestEmail: form.email, guestPhone: form.phone, quantity: form.quantity },
    });
    toast({ title: "Dinner tickets added to cart!" });
    navigate("/checkout");
  };

  if (submitted) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <UtensilsCrossed className="h-5 w-5 text-primary" />
          <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Guest Details</p>
        </div>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="d-name" className="text-[#1A1A1A] font-medium">Full Name</Label>
            <Input id="d-name" name="name" value={form.name} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="d-email" className="text-[#1A1A1A] font-medium">Email</Label>
              <Input id="d-email" name="email" type="email" value={form.email} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-phone" className="text-[#1A1A1A] font-medium">Phone</Label>
              <Input id="d-phone" name="phone" type="tel" value={form.phone} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-quantity" className="text-[#1A1A1A] font-medium">Number of Tickets</Label>
            <Input id="d-quantity" name="quantity" type="number" min={1} value={form.quantity} onChange={handleChange} required className="rounded border-[#1A1A1A]/15 w-32" />
          </div>
          <p className="text-[#1A1A1A]/60 font-medium">
            {form.quantity} ticket{form.quantity !== 1 ? "s" : ""} × ${DINNER_PRICE} = <span className="text-[#1A1A1A] font-bold">${total}</span>
          </p>
        </div>
      </div>
      <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
        Add to Cart — ${total}
      </Button>
    </form>
  );
};

/* ─── Main Page ─── */
const RegisterPage = () => {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [regStatus, setRegStatus] = useState<RegistrationStatus>("coming_soon");

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

  const [form, setForm] = useState({
    teamName: "", captainName: "", captainEmail: "", captainPhone: "",
    street: "", city: "", province: "", postalCode: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addItem({
      type: "registration",
      description: `Team Registration: ${form.teamName}`,
      amount: 600,
      formData: { ...form },
    });
    setSubmitted(true);
    toast({ title: "Team registration added to cart!" });
  };

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

  // Sold Out state — show waitlist
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

  // Registration submitted confirmation
  if (submitted) {
    return (
      <div className="section-light">
        <div className="container py-20 text-center space-y-6 animate-fade-in">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Registration Added!</h2>
          <p className="text-[#1A1A1A]/60">"{form.teamName}" has been added to your cart.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#1A1A1A]/5" onClick={() => { setSubmitted(false); setForm({ teamName: "", captainName: "", captainEmail: "", captainPhone: "", street: "", city: "", province: "", postalCode: "" }); }}>
              Continue Shopping
            </Button>
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => navigate("/checkout")}>Go to Checkout</Button>
          </div>
        </div>
      </div>
    );
  }

  // Open — registration + dinner form
  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <img src={registrationHero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="container py-20 md:py-28 animate-fade-in relative z-10">
          <p className="section-label">Join Us</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Join Us
          </h1>
          <p className="text-white/60 text-lg">Register your team or grab dinner-only tickets</p>
          {spotsAvailable !== null && (
            <div className="flex items-center gap-2 text-primary font-heading font-bold mt-4">
              <Users className="h-5 w-5" />
              <span>{spotsAvailable} spots remaining</span>
            </div>
          )}
        </div>
      </section>

      {/* Section 1: Team Registration */}
      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] mb-2">Register Your Team</h2>
          <p className="text-[#1A1A1A]/60 mb-6">$600 per team of 4 golfers</p>
          <p className="text-sm text-primary font-medium bg-primary/10 border border-primary/20 rounded px-4 py-3 mb-6">
            Team registration includes dinner on Thursday evening for all 4 golfers.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
            <div>
              <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Team Details</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamName" className="text-[#1A1A1A] font-medium">Business / Team Name</Label>
                  <Input id="teamName" name="teamName" value={form.teamName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="captainName" className="text-[#1A1A1A] font-medium">Captain Full Name</Label>
                    <Input id="captainName" name="captainName" value={form.captainName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="captainEmail" className="text-[#1A1A1A] font-medium">Email</Label>
                    <Input id="captainEmail" name="captainEmail" type="email" value={form.captainEmail} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="captainPhone" className="text-[#1A1A1A] font-medium">Phone</Label>
                  <Input id="captainPhone" name="captainPhone" type="tel" value={form.captainPhone} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
              </div>
            </div>

            <div>
              <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-4">Mailing Address</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-[#1A1A1A] font-medium">Street Address</Label>
                  <Input id="street" name="street" value={form.street} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[#1A1A1A] font-medium">City</Label>
                    <Input id="city" name="city" value={form.city} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province" className="text-[#1A1A1A] font-medium">Province</Label>
                    <Input id="province" name="province" value={form.province} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode" className="text-[#1A1A1A] font-medium">Postal Code</Label>
                    <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
              Add to Cart — $600
            </Button>
          </form>
        </div>
      </section>

      {/* Separator */}
      <div className="container max-w-2xl">
        <hr className="border-[#1A1A1A]/10" />
      </div>

      {/* Section 2: Dinner Only */}
      <section className="bg-[#F8F6F3]">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-[#1A1A1A] mb-2">Dinner Only</h2>
          <p className="text-[#1A1A1A]/60 mb-6">$45 per person — join us for the Thursday evening dinner without golfing</p>
          <DinnerSection />
        </div>
      </section>
    </div>
  );
};

export default RegisterPage;
