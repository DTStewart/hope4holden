import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, ShoppingCart } from "lucide-react";

const CheckoutPage = () => {
  const { items, totalAmount, clearCart, setDrawerOpen } = useCart();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  useEffect(() => {
    if (success) {
      clearCart();
    }
  }, [success, clearCart]);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((item) => ({
            type: item.type,
            description: item.description,
            amount: item.amount,
            formData: item.formData,
          })),
          returnUrl: window.location.origin + "/checkout",
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({
        title: "Checkout failed",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    const hasRecurring = items.some((i) => i.formData?.wantsRecurring);
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
        <CheckCircle className="h-20 w-20 text-primary mx-auto" />
        <h1 className="font-heading font-bold text-4xl">Thank You!</h1>
        <p className="text-lg text-muted-foreground">
          Your payment was successful. Thank you for supporting Hope 4 Holden and the fight against A-T!
        </p>
        {hasRecurring && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                You selected a recurring donation. To set up monthly giving, please visit the{" "}
                <a
                  href="https://www.atcp.org/donate"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  ATCP donation page
                </a>{" "}
                to complete your recurring donation setup.
              </p>
            </CardContent>
          </Card>
        )}
        <Button onClick={() => navigate("/")} size="lg">
          Back to Home
        </Button>
      </div>
    );
  }

  // Canceled state
  if (canceled) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
        <XCircle className="h-20 w-20 text-destructive mx-auto" />
        <h1 className="font-heading font-bold text-3xl">Payment Canceled</h1>
        <p className="text-muted-foreground">
          Your payment was not processed. Your cart items are still saved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            Continue Shopping
          </Button>
          <Button onClick={() => setDrawerOpen(true)}>View Cart</Button>
        </div>
      </div>
    );
  }

  // Cart review / checkout state
  if (items.length === 0) {
    return (
      <div className="container py-20 text-center space-y-6 animate-fade-in max-w-lg mx-auto">
        <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto" />
        <h1 className="font-heading font-bold text-3xl">Your Cart is Empty</h1>
        <p className="text-muted-foreground">Add items to get started.</p>
        <Button onClick={() => navigate("/")} variant="outline">
          Browse Options
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-12 md:py-20 max-w-2xl mx-auto space-y-8 animate-fade-in">
      <h1 className="font-heading font-bold text-4xl text-center">Checkout</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
              <div>
                <p className="font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
              </div>
              <span className="font-semibold">${item.amount.toLocaleString()}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between font-heading font-bold text-lg">
            <span>Total</span>
            <span>${totalAmount.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleCheckout}
        className="w-full"
        size="lg"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Redirecting to payment...
          </>
        ) : (
          `Pay $${totalAmount.toLocaleString()} CAD`
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Payments are securely processed by Stripe. Tax receipts for donations are issued by the ATCP.
      </p>
    </div>
  );
};

export default CheckoutPage;
