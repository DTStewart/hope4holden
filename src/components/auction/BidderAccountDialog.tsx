import { useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { type BidderSession, getStoredSessionToken, clearStoredSessionToken } from "@/hooks/useBidderSession";
import { Loader2, CreditCard, LogOut, CheckCircle, Gavel } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidder: BidderSession;
  onChanged: () => void;
  onSignedOut: () => void;
}

export function BidderAccountDialog({ open, onOpenChange, bidder, onChanged, onSignedOut }: Props) {
  const [attending, setAttending] = useState(bidder.attending_event);
  const [savingAttending, setSavingAttending] = useState(false);
  const [changingCard, setChangingCard] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<StripeJs | null> | null>(null);

  const handleAttendingChange = async (v: boolean) => {
    setAttending(v);
    setSavingAttending(true);
    const token = getStoredSessionToken();
    if (!token) return;
    try {
      const { error } = await anonSupabase.rpc("update_bidder_attending", {
        _session_token: token,
        _attending: v,
      });
      if (error) throw error;
      onChanged();
      toast({ title: v ? "We'll plan Thursday pickup" : "Pickup preference saved" });
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
      setAttending(!v); // revert visual
    } finally {
      setSavingAttending(false);
    }
  };

  const startChangeCard = async () => {
    setChangingCard(true);
    try {
      const token = getStoredSessionToken();
      if (!token) throw new Error("No session");
      // Re-use the register endpoint; passing sessionToken + existing email triggers
      // a fresh SetupIntent for the existing bidder without creating duplicates.
      const { data, error } = await anonSupabase.functions.invoke("auction-register-bidder", {
        body: {
          email: bidder.email,
          phone: bidder.phone,
          displayName: bidder.display_name,
          attendingEvent: attending,
          sessionToken: token,
        },
      });
      if (error) throw error;
      const payload = data as any;
      if (!payload?.clientSecret || !payload?.publishableKey) throw new Error("Missing Stripe setup data");
      setClientSecret(payload.clientSecret);
      setPublishableKey(payload.publishableKey);
      setStripePromise(loadStripe(payload.publishableKey));
    } catch (err: any) {
      toast({ title: "Couldn't start card update", description: err.message, variant: "destructive" });
      setChangingCard(false);
    }
  };

  const handleSignOut = () => {
    clearStoredSessionToken();
    onSignedOut();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your auction account</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded bg-muted/40 p-3 text-sm space-y-1">
            <div><span className="text-muted-foreground">Name:</span> {bidder.display_name}</div>
            <div><span className="text-muted-foreground">Email:</span> {bidder.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {bidder.phone}</div>
            <div>
              <span className="text-muted-foreground">Payment method:</span>{" "}
              {bidder.has_payment_method ? (
                <span className="inline-flex items-center gap-1 text-primary"><CheckCircle className="h-3 w-3" /> Card on file</span>
              ) : (
                <span className="text-destructive">None — add a card to bid</span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="account-attending"
              checked={attending}
              disabled={savingAttending}
              onCheckedChange={(v) => handleAttendingChange(v === true)}
            />
            <Label htmlFor="account-attending" className="text-sm font-normal leading-snug cursor-pointer">
              I'll be at the tournament dinner on Thursday, June 18
              {savingAttending && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
            </Label>
          </div>

          {/* View my wins */}
          <Button asChild variant="outline" className="w-full">
            <Link to="/auction/my-wins" onClick={() => onOpenChange(false)}>
              <Gavel className="h-4 w-4 mr-2" />
              My auction activity
            </Link>
          </Button>

          {/* Change card */}
          {!changingCard && (
            <Button variant="outline" className="w-full" onClick={startChangeCard}>
              <CreditCard className="h-4 w-4 mr-2" />
              {bidder.has_payment_method ? "Change payment method" : "Add a payment method"}
            </Button>
          )}

          {changingCard && !clientSecret && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {changingCard && clientSecret && stripePromise && (
            <div className="pt-2">
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                <CardForm
                  onSaved={() => {
                    setChangingCard(false);
                    setClientSecret(null);
                    onChanged();
                  }}
                  onCancel={() => {
                    setChangingCard(false);
                    setClientSecret(null);
                  }}
                />
              </Elements>
            </div>
          )}

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out on this device
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CardForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
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
      const token = getStoredSessionToken();
      if (!token) throw new Error("No session");
      const { data: attached, error: attachErr } = await anonSupabase.rpc(
        "attach_bidder_payment_method",
        { _session_token: token, _payment_method_id: paymentMethodId }
      );
      if (attachErr || !attached) throw attachErr || new Error("Attach failed");
      toast({ title: "Payment method updated" });
      onSaved();
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !elements || submitting} className="flex-1">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save card
        </Button>
      </div>
    </form>
  );
}
