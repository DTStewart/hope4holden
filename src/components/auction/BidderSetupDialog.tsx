import { useEffect, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { bidderSupabase } from "@/integrations/supabase/bidderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedInEmail: string;
  onReady: () => void;
}

type Step = "info" | "card" | "done";

export function BidderSetupDialog({ open, onOpenChange, signedInEmail, onReady }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [attendingEvent, setAttendingEvent] = useState(false);
  const [notifyOutbidSms, setNotifyOutbidSms] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);

  useEffect(() => {
    if (open) {
      setStep("info");
      setClientSecret(null);
      setPublishableKey(null);
      setStripePromise(null);
    }
  }, [open]);

  useEffect(() => {
    if (publishableKey && !stripePromise) {
      setStripePromise(loadStripe(publishableKey));
    }
  }, [publishableKey, stripePromise]);

  const submitInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length < 7 || displayName.trim().length < 2) {
      toast({ title: "Fill in phone and name", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await bidderSupabase.functions.invoke("auction-register-bidder", {
        body: { phone, displayName, attendingEvent },
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.clientSecret || !payload?.publishableKey) {
        throw new Error("Missing Stripe setup data");
      }
      // Save the SMS opt-in preference if the user flipped it off (default is on).
      if (!notifyOutbidSms) {
        await bidderSupabase.rpc("update_bidder_notify_outbid", { _enabled: false });
      }
      setClientSecret(payload.clientSecret);
      setPublishableKey(payload.publishableKey);
      setStep("card");
    } catch (err: any) {
      let description = err?.message || "Try again.";
      try {
        const body = await err?.context?.json?.();
        if (body?.error) description = body.error;
      } catch { /* fall through */ }
      toast({ title: "Setup failed", description, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>One-time setup</DialogTitle>
          <DialogDescription>
            {step === "info" && `Signed in as ${signedInEmail}. A few quick details to complete your profile.`}
            {step === "card" && "Add a card, Apple Pay, or Google Pay. Only charged if you win."}
            {step === "done" && "You're set!"}
          </DialogDescription>
        </DialogHeader>

        {step === "info" && (
          <form onSubmit={submitInfo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="setup-name">Display name</Label>
              <Input
                id="setup-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Shown on leaderboard (e.g., Alex S.)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setup-phone">Phone</Label>
              <Input
                id="setup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(204) 555-1234"
                required
              />
            </div>
            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="setup-attending"
                checked={attendingEvent}
                onCheckedChange={(v) => setAttendingEvent(v === true)}
              />
              <Label htmlFor="setup-attending" className="text-sm font-normal leading-snug cursor-pointer">
                I'll be at the tournament dinner on Thursday, June 18
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Helps us plan pickup. You can change this later.
                </span>
              </Label>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="setup-notify-sms"
                checked={notifyOutbidSms}
                onCheckedChange={(v) => setNotifyOutbidSms(v === true)}
              />
              <Label htmlFor="setup-notify-sms" className="text-sm font-normal leading-snug cursor-pointer">
                Text me if I'm outbid
                <span className="block text-xs text-muted-foreground mt-0.5">
                  We'll only text when someone outbids you. Reply STOP any time to opt out.
                </span>
              </Label>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Continue to payment
            </Button>
          </form>
        )}

        {step === "card" && stripePromise && clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <CardStep onDone={() => { setStep("done"); onReady(); setTimeout(() => onOpenChange(false), 1200); }} />
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

function CardStep({ onDone }: { onDone: () => void }) {
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
      const paymentMethodId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : (setupIntent.payment_method as any).id;
      const { data: attached, error: attachErr } = await bidderSupabase.rpc(
        "attach_bidder_payment_method",
        { _payment_method_id: paymentMethodId }
      );
      if (attachErr || !attached) throw attachErr || new Error("Attach failed");
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
    </form>
  );
}
