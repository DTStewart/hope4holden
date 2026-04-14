import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const RegisterPage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const navigate = useNavigate();
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
    teamName: "",
    captainName: "",
    captainEmail: "",
    captainPhone: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
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

  if (!registrationOpen) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in">
        <h1 className="font-heading font-bold text-4xl">Tournament Sold Out</h1>
        <p className="text-muted-foreground text-lg">All spots have been filled. Join the waitlist to be notified if a spot opens up.</p>
        {/* Waitlist form - simplified */}
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6 space-y-4">
            <Input placeholder="Your name" />
            <Input placeholder="Your email" type="email" />
            <Button className="w-full">Join Waitlist</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in">
        <CheckCircle className="h-16 w-16 text-primary mx-auto" />
        <h2 className="font-heading font-bold text-3xl">Team Registration Added!</h2>
        <p className="text-muted-foreground">"{form.teamName}" has been added to your cart.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ teamName: "", captainName: "", captainEmail: "", captainPhone: "", street: "", city: "", province: "", postalCode: "" }); }}>
            Continue Shopping
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>Go to Cart</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-20 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Register Your Team</h1>
        <p className="text-lg text-muted-foreground">$600 per team of 4 golfers</p>
        {spotsAvailable !== null && (
          <div className="flex items-center justify-center gap-2 text-primary font-medium">
            <Users className="h-5 w-5" />
            <span>{spotsAvailable} spots remaining</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Team Information</CardTitle>
          <CardDescription>
            Registration fee of $600 includes dinner on Thursday evening and golf on Friday for your team of 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Business / Team Name</Label>
              <Input id="teamName" name="teamName" value={form.teamName} onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="captainName">Team Captain Full Name</Label>
                <Input id="captainName" name="captainName" value={form.captainName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="captainEmail">Email</Label>
                <Input id="captainEmail" name="captainEmail" type="email" value={form.captainEmail} onChange={handleChange} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="captainPhone">Phone</Label>
              <Input id="captainPhone" name="captainPhone" type="tel" value={form.captainPhone} onChange={handleChange} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input id="street" name="street" value={form.street} onChange={handleChange} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" value={form.city} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province / State</Label>
                <Input id="province" name="province" value={form.province} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} required />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Add to Cart — $600
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
