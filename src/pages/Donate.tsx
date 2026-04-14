import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, Heart } from "lucide-react";

const suggestedAmounts = [25, 50, 100, 250, 500];

const DonatePage = () => {
  const { addItem, setDrawerOpen } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState({
    donorName: "",
    donorEmail: "",
    wantsRecurring: false,
  });

  const amount = isCustom ? Number(customAmount) : selectedAmount;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast({ title: "Please enter a valid donation amount", variant: "destructive" });
      return;
    }
    addItem({
      type: "donation",
      description: `Donation: $${amount}`,
      amount,
      formData: { ...form, amount, wantsRecurring: form.wantsRecurring },
    });
    setSubmitted(true);
    toast({ title: "Donation added to cart!" });
  };

  if (submitted) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in">
        <CheckCircle className="h-16 w-16 text-primary mx-auto" />
        <h2 className="font-heading font-bold text-3xl">Donation Added!</h2>
        <p className="text-muted-foreground">Your ${amount} donation has been added to your cart.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ donorName: "", donorEmail: "", wantsRecurring: false }); setSelectedAmount(100); setIsCustom(false); setCustomAmount(""); }}>
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
        <Heart className="h-10 w-10 text-primary mx-auto" />
        <h1 className="font-heading font-bold text-4xl md:text-5xl">Make a Donation</h1>
        <p className="text-lg text-muted-foreground">
          Every dollar helps fund research for a cure for Ataxia Telangiectasia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Donation Details</CardTitle>
          <CardDescription>
            Hope 4 Holden raises funds for the Ataxia Telangiectasia Children's Project (ATCP), a
            registered charity. Tax receipts for donations are issued by the ATCP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount selection */}
            <div className="space-y-3">
              <Label>Select Amount</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {suggestedAmounts.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={!isCustom && selectedAmount === amt ? "default" : "outline"}
                    onClick={() => { setSelectedAmount(amt); setIsCustom(false); }}
                    className="font-semibold"
                  >
                    ${amt}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={isCustom ? "default" : "outline"}
                  onClick={() => setIsCustom(true)}
                >
                  Other
                </Button>
              </div>
              {isCustom && (
                <div className="space-y-2">
                  <Label htmlFor="customAmount">Custom Amount ($)</Label>
                  <Input
                    id="customAmount"
                    type="number"
                    min="1"
                    step="1"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount"
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="donorName">Full Name</Label>
                <Input id="donorName" name="donorName" value={form.donorName} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donorEmail">Email</Label>
                <Input id="donorEmail" name="donorEmail" type="email" value={form.donorEmail} onChange={handleChange} required />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={form.wantsRecurring}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, wantsRecurring: !!checked }))}
              />
              <Label htmlFor="recurring" className="text-sm cursor-pointer">
                I would like to set up a recurring donation
              </Label>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Add to Cart — ${amount || 0}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default DonatePage;
