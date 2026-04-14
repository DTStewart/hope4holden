import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Star, Award, Medal, Flag } from "lucide-react";

const tiers = [
  {
    name: "Title Sponsor",
    price: 5000,
    icon: Star,
    benefits: [
      "Logo on all event materials",
      "Prominent signage at dinner and golf course",
      "Speaking opportunity at dinner",
      "Complimentary team registration (4 golfers)",
      "Social media recognition",
    ],
  },
  {
    name: "Gold Sponsor",
    price: 2500,
    icon: Award,
    benefits: [
      "Logo on event materials",
      "Signage at dinner and golf course",
      "Recognition during speeches",
      "Social media recognition",
    ],
  },
  {
    name: "Silver Sponsor",
    price: 1000,
    icon: Medal,
    benefits: [
      "Logo on event program",
      "Signage at golf course",
      "Social media recognition",
    ],
  },
  {
    name: "Hole Sponsor",
    price: 500,
    icon: Flag,
    benefits: [
      "Custom sign at a designated hole",
      "Logo on event website",
      "Social media mention",
    ],
  },
];

const SponsorPage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const [selectedTier, setSelectedTier] = useState<typeof tiers[0] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    addItem({
      type: "sponsorship",
      description: `${selectedTier.name}: ${form.businessName}`,
      amount: selectedTier.price,
      formData: { ...form, tier: selectedTier.name },
    });
    setSubmitted(true);
    setSelectedTier(null);
    toast({ title: "Sponsorship added to cart!" });
  };

  if (submitted) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in">
        <CheckCircle className="h-16 w-16 text-primary mx-auto" />
        <h2 className="font-heading font-bold text-3xl">Sponsorship Added!</h2>
        <p className="text-muted-foreground">Your sponsorship has been added to your cart.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ businessName: "", contactName: "", contactEmail: "", contactPhone: "" }); }}>
            Continue Shopping
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>Go to Cart</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-20 space-y-16 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Become a Sponsor</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Support the Hope 4 Holden tournament and make a meaningful impact in the fight against A-T.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tiers.map((tier) => (
          <Card key={tier.name} className="group hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col">
            <CardHeader className="text-center">
              <tier.icon className="h-10 w-10 text-primary mx-auto mb-2" />
              <CardTitle className="font-heading text-lg">{tier.name}</CardTitle>
              <p className="text-3xl font-heading font-bold text-primary">${tier.price.toLocaleString()}</p>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2 flex-1 mb-6">
                {tier.benefits.map((b) => (
                  <li key={b} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => setSelectedTier(tier)}>
                Become a Sponsor
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current sponsors placeholder */}
      <div className="text-center space-y-6">
        <h2 className="font-heading font-bold text-3xl">Current Sponsors</h2>
        <div className="py-12 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">Sponsor logos will appear here</p>
        </div>
      </div>

      {/* Sponsor form dialog */}
      <Dialog open={!!selectedTier} onOpenChange={(open) => !open && setSelectedTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{selectedTier?.name} — ${selectedTier?.price.toLocaleString()}</DialogTitle>
            <DialogDescription>Fill in your details to add this sponsorship to your cart.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" name="businessName" value={form.businessName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input id="contactPhone" name="contactPhone" type="tel" value={form.contactPhone} onChange={handleChange} required />
            </div>
            <Button type="submit" className="w-full">Add to Cart — ${selectedTier?.price.toLocaleString()}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SponsorPage;
