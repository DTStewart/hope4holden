import { useState } from "react";
import { useNavigate } from "react-router-dom";
import atcpLogo from "@/assets/atcp-logo.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

const suggestedAmounts = [25, 50, 100, 250, 500];

const DonatePage = () => {
  const { addItem, contact, setContact } = useCart();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState({ donorName: contact.name, donorEmail: contact.email, wantsRecurring: false });

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
    setContact({ name: form.donorName, email: form.donorEmail });
    setSubmitted(true);
    toast({ title: "Donation added to cart!" });
  };

  if (submitted) {
    return (
      <div className="section-light">
        <div className="container py-20 text-center space-y-6 animate-fade-in">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <h2 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Donation Added!</h2>
          <p className="text-[#1A1A1A]/60">Your ${amount} donation has been added to your cart.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A]" onClick={() => { setSubmitted(false); setForm({ donorName: "", donorEmail: "", wantsRecurring: false }); setSelectedAmount(100); setIsCustom(false); setCustomAmount(""); }}>
              Continue Shopping
            </Button>
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => navigate("/checkout")}>Go to Checkout</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="section-dark">
        <div className="container py-20 md:py-28 animate-fade-in">
          <p className="section-label">Support the Cause</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mb-4">
            Make a Donation
          </h1>
          <p className="text-white/60 text-lg max-w-xl">
            Every dollar helps fund research for a cure for Ataxia Telangiectasia.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-16 md:py-20 max-w-2xl animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 md:p-10 border border-[#1A1A1A]/10 rounded">
            <div className="flex items-center gap-3 mb-2">
              <img src={atcpLogo} alt="A-T Children's Project logo" className="h-10 w-auto" />
            </div>
            <p className="text-sm text-[#1A1A1A]/50 text-left">
              Hope 4 Holden raises funds for the ATCP, a registered charity. Tax receipts are issued by the ATCP.
            </p>

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
                    isCustom
                      ? "bg-primary text-white"
                      : "bg-[#1A1A1A]/5 text-[#1A1A1A] hover:bg-[#1A1A1A]/10"
                  }`}
                >
                  Other
                </button>
              </div>
              {isCustom && (
                <div className="space-y-2">
                  <Label htmlFor="customAmount" className="text-[#1A1A1A] font-medium">Custom Amount ($)</Label>
                  <Input id="customAmount" type="number" min="1" step="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Enter amount" required className="rounded border-[#1A1A1A]/15" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="donorName" className="text-[#1A1A1A] font-medium">Full Name</Label>
                <Input id="donorName" name="donorName" value={form.donorName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donorEmail" className="text-[#1A1A1A] font-medium">Email</Label>
                <Input id="donorEmail" name="donorEmail" type="email" value={form.donorEmail} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="recurring"
                checked={form.wantsRecurring}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, wantsRecurring: !!checked }))}
              />
              <Label htmlFor="recurring" className="text-sm cursor-pointer text-[#1A1A1A]/70">
                I would like to set up a recurring donation
              </Label>
            </div>

            <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg">
              Add to Cart — ${amount || 0}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default DonatePage;
