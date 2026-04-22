import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type InvoiceSummary = {
  id: string;
  item_id: string;
  item_title: string;
  bidder_display_name: string;
  amount: number;
  status: string;
};

export default function AuctionPay() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "already_paid" | "invalid" | "error" | "success">("loading");
  const [invoice, setInvoice] = useState<InvoiceSummary | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auction-pay-fallback?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (res.status === 404) {
            setStatus("invalid");
            setErrorMessage(body?.error || "This payment link is invalid or already paid.");
            return;
          }
          throw new Error(body?.error || "Couldn't load this payment.");
        }
        const data = await res.json();
        if (data.alreadyPaid) {
          setInvoice(data.invoice);
          setStatus("already_paid");
          return;
        }
        if (!data.clientSecret || !data.publishableKey) {
          throw new Error("Payment configuration missing.");
        }
        setInvoice(data.invoice);
        setClientSecret(data.clientSecret);
        setPublishableKey(data.publishableKey);
        setStatus("ready");
      } catch (err: any) {
        console.error("[AuctionPay] load failed:", err);
        setStatus("error");
        setErrorMessage(err?.message || "Something went wrong.");
      }
    })();
  }, [token]);

  const onPaid = async () => {
    if (!token) return;
    try {
      await anonSupabase.rpc("mark_auction_invoice_paid", {
        _token: token,
        _payment_intent_id: null,
      });
    } catch (err) {
      console.warn("mark_auction_invoice_paid failed (non-fatal — Stripe already has the payment):", err);
    }
    setStatus("success");
  };

  if (status === "loading") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (status === "invalid" || status === "error") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <AlertCircle className="h-14 w-14 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">
            {status === "invalid" ? "Link not valid" : "Something went wrong"}
          </h1>
          <p className="text-foreground/60">{errorMessage || "This link may have already been used."}</p>
          <p className="text-sm text-foreground/50">
            If you think this is a mistake, contact{" "}
            <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>.
          </p>
        </div>
      </div>
    );
  }

  if (status === "already_paid" || status === "success") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <CheckCircle className="h-14 w-14 text-primary mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Payment received</h1>
          <p className="text-foreground/60">
            Thank you! We'll be in touch about pickup for <strong>{invoice?.item_title}</strong>.
          </p>
        </div>
      </div>
    );
  }

  // status === "ready"
  return (
    <div className="section-light">
      <div className="container py-12 md:py-16 max-w-xl mx-auto animate-fade-in">
        <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground mb-2">
          Complete your payment
        </h1>
        <p className="text-foreground/60 mb-6">
          {invoice?.bidder_display_name && `${invoice.bidder_display_name} — `}
          you won <strong>{invoice?.item_title}</strong> at Hope 4 Holden's silent auction.
        </p>

        <div className="bg-accent/10 border border-accent/20 rounded p-4 mb-6">
          <div className="flex justify-between">
            <span className="text-foreground/60">Amount</span>
            <span className="font-heading font-bold text-xl">${invoice?.amount?.toLocaleString()} CAD</span>
          </div>
        </div>

        {stripePromise && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <PayForm onPaid={onPaid} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function PayForm({ onPaid }: { onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });
      if (error) {
        toast({ title: "Payment failed", description: error.message, variant: "destructive" });
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        toast({ title: "Payment successful" });
        onPaid();
        return;
      }
      if (paymentIntent?.status === "processing") {
        toast({ title: "Processing", description: "Your payment is being processed." });
        onPaid();
        return;
      }
      toast({ title: "Payment not complete", description: `Status: ${paymentIntent?.status || "unknown"}`, variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || !elements || submitting} className="w-full" size="lg">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {submitting ? "Processing…" : "Pay now"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Your payment is processed securely by Stripe.
      </p>
    </form>
  );
}
