import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const RegisterPage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [spotsAvailable, setSpotsAvailable] = useState<number | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["registration_open", "spots_remaining"]);
      if (data) {
        for (const s of data) {
          if (s.key === "registration_open") setRegistrationOpen(s.value === true || s.value === "true");
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

  if (!registrationOpen) {
    return (
      <div>
        <section className="section-dark">
          <div className="container py-20 md:py-28 text-center animate-fade-in">
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
          <p className="section-label">Team Registration</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Register Your Team
          </h1>
          <p className="text-white/60 text-lg">$600 per team of 4 golfers</p>
          {spotsAvailable !== null && (
            <div className="flex items-center gap-2 text-primary font-heading font-bold mt-4">
              <Users className="h-5 w-5" />
              <span>{spotsAvailable} spots remaining</span>
            </div>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
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
    </div>
  );
};

export default RegisterPage;
