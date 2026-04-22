import { useEffect, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { setStoredSessionToken } from "@/hooks/useBidderSession";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRegistered: () => void;
}

type Step = "info" | "card" | "done";

export function BidderRegistrationDialog({ open, onOpenChange, onRegistered }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep("info");
      setClientSecret(null);
      setPublishableKey(null);
      setSessionToken(null);
      setStripePromise(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (publishableKey && !stripePromise) {
      setStripePromise(loadStripe(publishableKey));
    }
  }, [publishableKey, stripePromise]);

  const submitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@") || phone.trim().length < 7 || displayName.trim().length < 2) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await anonSupabase.functions.invoke("auction-register-bidder", {
        body: { email, phone, displayName },
      });
      if (error) throw error;
      const { sessionToken: st, clientSecret: cs, publishableKey: pk } = data as any;
      if (!st || !cs || !pk) throw new Error("Registration response missing required fields.");
      setStoredSessionToken(st);
      setSessionToken(st);
      setClientSecret(cs);
      setPublishableKey(pk);
      setStep("card");
    } catch (err: any) {
      let description = err?.message || "Please try again.";
      try {
        const body = await err?.context?.json?.();
        if (body?.error) description = body.error;
      } catch { /* keep err.message */ }
      toast({ title: "Registration failed", description, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Register to bid</DialogTitle>
          <DialogDescription>
            {step === "info" && "Quick one-time setup. We'll save a card so you can bid with a single tap."}
            {step === "card" && "Add a card, Apple Pay, or Google Pay. Your card is only charged if you win."}
            {step === "done" && "You're all set!"}
          </DialogDescription>
        </DialogHeader>

        {step === "info" && (
          <form onSubmit={submitInfo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-name">Display name</Label>
              <Input
                id="reg-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Shown on leaderboard (e.g., Alex S.)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-phone">Phone</Label>
              <Input
                id="reg-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(204) 555-1234"
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Continue to payment
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              We'll email + text you outbid alerts and winner details.
            </p>
          </form>
        )}

        {step === "card" && stripePromise && clientSecret && sessionToken && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CardStep
              sessionToken={sessionToken}
              onDone={() => {
                setStep("done");
                onRegistered();
                setTimeout(() => onOpenChange(false), 1200);
              }}
            />
          </Elements>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="font-heading font-bold">You're ready to bid.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CardStep({ sessionToken, onDone }: { sessionToken: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });
      if (error) {
        toast({ title: "Couldn't save card", description: error.message, variant: "destructive" });
        return;
      }
      if (setupIntent?.status !== "succeeded" || !setupIntent.payment_method) {
        toast({ title: "Card not saved yet", description: "Please try again.", variant: "destructive" });
        return;
      }

      // Attach the PaymentMethod id to our bidder record.
      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : (setupIntent.payment_method as any).id;

      const { data: attached, error: attachErr } = await anonSupabase.rpc(
        "attach_bidder_payment_method",
        { _session_token: sessionToken, _payment_method_id: paymentMethodId }
      );
      if (attachErr || !attached) {
        toast({
          title: "Card saved with Stripe but not linked to your account",
          description: "Please try bidding — if it fails, contact us.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Card saved" });
      onDone();
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || !elements || submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save card
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Your card is saved securely with Stripe. We only charge if you win.
      </p>
    </form>
  );
}
