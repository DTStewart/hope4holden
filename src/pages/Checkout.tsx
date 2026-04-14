import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, ShoppingCart, ExternalLink } from "lucide-react";

const CheckoutPage = () => {
  const { items, totalAmount, clearCart, setDrawerOpen } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [hadRecurring, setHadRecurring] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    if (success) {
      // Check for recurring donations before clearing the cart
      const stored = localStorage.getItem("h4h-cart");
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

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((item) => ({ type: item.type, description: item.description, amount: item.amount, formData: item.formData })),
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
            <Button className="rounded bg-primary text-white hover:bg-[#4A7C09]" onClick={() => setDrawerOpen(true)}>View Cart</Button>
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
      <div className="container py-16 md:py-24 max-w-2xl mx-auto space-y-8 animate-fade-in">
        <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-[#1A1A1A]">Checkout</h1>

        <div className="bg-white p-8 border border-[#1A1A1A]/10 rounded space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
              <div>
                <p className="font-medium text-[#1A1A1A]">{item.description}</p>
                <p className="text-xs text-[#1A1A1A]/40 font-heading uppercase tracking-wider">{item.type}</p>
              </div>
              <span className="font-heading font-bold text-[#1A1A1A]">${item.amount.toLocaleString()}</span>
            </div>
          ))}
          <Separator className="bg-[#1A1A1A]/10" />
          <div className="flex justify-between font-heading font-extrabold text-lg text-[#1A1A1A]">
            <span>Total</span>
            <span>${totalAmount.toLocaleString()}</span>
          </div>
        </div>

        <Button onClick={handleCheckout} className="w-full rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider" size="lg" disabled={loading}>
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to payment...</>
          ) : (
            `Pay $${totalAmount.toLocaleString()} CAD`
          )}
        </Button>

        <p className="text-xs text-[#1A1A1A]/40 text-left">
          Payments are securely processed by Stripe. Tax receipts for donations are issued by the ATCP.
        </p>
      </div>
    </div>
  );
};

export default CheckoutPage;
