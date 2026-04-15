import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, ShoppingCart, ExternalLink, Trash2 } from "lucide-react";

const CheckoutPage = () => {
  const { items, totalAmount, clearCart, removeItem, setDrawerOpen } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hadRecurring, setHadRecurring] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  // Determine which sections to show based on cart contents
  const hasRegistration = useMemo(() => items.some(i => i.type === "registration"), [items]);
  const hasSponsorship = useMemo(() => items.some(i => i.type === "sponsorship"), [items]);
  const hasDonation = useMemo(() => items.some(i => i.type === "donation"), [items]);
  const needsAddress = hasRegistration || hasDonation;

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    teamName: "",
    sponsorBusinessName: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    if (success) {
      const stored = localStorage.getItem("h4h_cart");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const hasRecurring = parsed.some(
            (item: any) => item.type === "donation" && item.formData?.wantsRecurring
          );
          if (hasRecurring) setHadRecurring(true);
        } catch {}
      }
      clearCart();
    }
  }, [success, clearCart]);

  const buildItemsPayload = () => {
    return items.map((item) => {
      let formData: Record<string, any> = { ...item.formData };

      switch (item.type) {
        case "registration":
          formData = {
            ...formData,
            captainName: form.fullName,
            captainEmail: form.email,
            captainPhone: form.phone,
            teamName: form.teamName,
            street: form.street,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
          };
          break;
        case "sponsorship":
          formData = {
            ...formData,
            businessName: form.sponsorBusinessName,
            contactName: form.fullName,
            contactEmail: form.email,
            contactPhone: form.phone,
          };
          break;
        case "donation":
          formData = {
            ...formData,
            donorName: form.fullName,
            donorEmail: form.email,
            street: form.street,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
          };
          break;
        case "dinner":
          formData = {
            ...formData,
            guestName: form.fullName,
            guestEmail: form.email,
            guestPhone: form.phone,
          };
          break;
      }

      return {
        type: item.type,
        description: item.description,
        amount: item.amount,
        formData,
      };
    });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: buildItemsPayload(),
          returnUrl: window.location.origin + "/checkout",
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
          <CheckCircle className="h-20 w-20 text-primary mx-auto" />
          <h1 className="font-heading font-extrabold text-4xl text-[#1A1A1A]">Thank You!</h1>
          <p className="text-[#1A1A1A]/60 text-lg">
            Your payment was successful. Thank you for supporting Hope 4 Holden.
          </p>
          <Button onClick={() => navigate("/")} size="lg" className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider">
            Back to Home
          </Button>
          {hadRecurring && (
            <div className="bg-accent/10 border border-accent/20 rounded p-6 text-left space-y-3">
              <p className="text-[#1A1A1A]/80 text-sm">
                To set up a recurring donation, please visit the ATCP website:
              </p>
              <Button asChild variant="outline" className="rounded border-primary text-primary hover:bg-primary/5">
                <a href="https://www.atcp.org/donate" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Set Up Recurring Donation
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (canceled) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
          <XCircle className="h-20 w-20 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Payment Canceled</h1>
          <p className="text-[#1A1A1A]/60">Your payment was not processed. Your cart items are still saved.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A]" onClick={() => navigate("/")}>Continue Shopping</Button>
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => navigate("/checkout")}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
          <ShoppingCart className="h-16 w-16 text-[#1A1A1A]/20 mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-[#1A1A1A]">Your Cart is Empty</h1>
          <p className="text-[#1A1A1A]/60">Add items to get started.</p>
          <Button onClick={() => navigate("/")} variant="outline" className="rounded border-[#1A1A1A]/20 text-[#1A1A1A]">Browse Options</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-light min-h-[60vh]">
      <div className="container py-16 md:py-24 max-w-2xl mx-auto animate-fade-in">
        <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A] mb-8">Checkout</h1>

        <form onSubmit={handleCheckout} className="space-y-8">
          {/* Contact Information — always shown */}
          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
            <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Contact Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="fullName" className="text-[#1A1A1A] font-medium">Full Name *</Label>
                <Input id="fullName" name="fullName" value={form.fullName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1A1A1A] font-medium">Email *</Label>
                <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[#1A1A1A] font-medium">Phone *</Label>
                <Input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>
          </div>

          {/* Team Registration Details — only if registration in cart */}
          {hasRegistration && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Team Registration Details</p>
              <div className="space-y-2">
                <Label htmlFor="teamName" className="text-[#1A1A1A] font-medium">Business / Team Name *</Label>
                <Input id="teamName" name="teamName" value={form.teamName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>
          )}

          {/* Sponsorship Details — only if sponsorship in cart */}
          {hasSponsorship && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Sponsorship Details</p>
              <div className="space-y-2">
                <Label htmlFor="sponsorBusinessName" className="text-[#1A1A1A] font-medium">Sponsor Business Name *</Label>
                <Input id="sponsorBusinessName" name="sponsorBusinessName" value={form.sponsorBusinessName} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
              </div>
            </div>
          )}

          {/* Mailing Address — if registration or donation */}
          {needsAddress && (
            <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
              <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Mailing Address</p>
              <p className="text-xs text-[#1A1A1A]/50">
                CRA requires the donor's full name and address for official donation receipts. This information will be passed to the ATCP for tax receipt issuance.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-[#1A1A1A] font-medium">Street Address *</Label>
                  <Input id="street" name="street" value={form.street} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[#1A1A1A] font-medium">City *</Label>
                    <Input id="city" name="city" value={form.city} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="province" className="text-[#1A1A1A] font-medium">Province *</Label>
                    <Input id="province" name="province" value={form.province} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode" className="text-[#1A1A1A] font-medium">Postal Code *</Label>
                    <Input id="postalCode" name="postalCode" value={form.postalCode} onChange={handleChange} required className="rounded border-[#1A1A1A]/15" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
            <p className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-[#1A1A1A]/40">Order Summary</p>
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-[#1A1A1A]">{item.description}</p>
                  <p className="text-xs text-[#1A1A1A]/40 font-heading uppercase tracking-wider">{item.type}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-heading font-bold text-[#1A1A1A]">${item.amount.toLocaleString()}</span>
                  <button type="button" onClick={() => removeItem(item.id)} className="text-[#1A1A1A]/30 hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <Separator className="bg-[#1A1A1A]/10" />
            <div className="flex justify-between font-heading font-extrabold text-lg text-[#1A1A1A]">
              <span>Total</span>
              <span>${totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <Button type="submit" className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg" disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to payment...</>
            ) : (
              `Pay $${totalAmount.toLocaleString()} CAD`
            )}
          </Button>

          <p className="text-xs text-[#1A1A1A]/40 text-left">
            Payments are securely processed by Stripe. Tax receipts for donations are issued by the ATCP.
          </p>
        </form>
      </div>
    </div>
  );
};

export default CheckoutPage;
