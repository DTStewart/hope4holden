import { useEffect, useState } from "react";
import { bidderSupabase } from "@/integrations/supabase/bidderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Gavel, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    title: string;
    starting_bid: number;
    market_value: number;
    bid_increment: number | null;
    pickup_option?: string;
  } | null;
  currentBid: number | null;
  defaultIncrement: number;
  bidderAttending: boolean;
  onBidPlaced: () => void;
}

function potentialReceipt(bid: number, fmv: number): number {
  if (fmv <= 0 || bid <= 0) return 0;
  if (fmv / bid > 0.8) return 0;
  return bid - fmv;
}

export function PlaceBidDialog({
  open, onOpenChange, item, currentBid, defaultIncrement, bidderAttending, onBidPlaced,
}: Props) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Authoritative current high bid, fetched when the dialog opens, so the bidder
  // always sees the true current bid / minimum even when realtime hasn't
  // delivered a recent bid to the page. undefined = not fetched yet (or fetch
  // failed) → fall back to the seeded `currentBid` prop; null = fetched and the
  // item genuinely has zero bids; number = the current high bid.
  const [liveBid, setLiveBid] = useState<number | null | undefined>(undefined);
  const [bidLoading, setBidLoading] = useState(false);

  const increment = item?.bid_increment ?? defaultIncrement ?? 5;
  const effectiveBid = liveBid !== undefined ? liveBid : currentBid;
  const minNext = item ? (effectiveBid != null ? effectiveBid + increment : item.starting_bid) : 0;

  // On open, fetch the item's current high bid directly so we never show a
  // stale "No bids yet". Overrides the possibly-stale currentBids prop; on
  // failure we fall back to that prop rather than blocking the dialog.
  useEffect(() => {
    if (!open || !item) {
      setLiveBid(undefined);
      setBidLoading(false);
      return;
    }
    let cancelled = false;
    setBidLoading(true);
    (async () => {
      try {
        const { data, error } = await bidderSupabase
          .from("auction_bids")
          .select("amount")
          .eq("item_id", item.id)
          .order("amount", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setLiveBid(data?.amount ?? null);
      } catch (err) {
        if (!cancelled) {
          console.warn("[place-bid] current-bid fetch failed, using seeded value:", err);
          setLiveBid(undefined);
        }
      } finally {
        if (!cancelled) setBidLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, item]);

  useEffect(() => {
    if (open && item) setAmount(String(minNext));
  }, [open, item, minNext]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    const numeric = Number(amount);
    if (!numeric || numeric < minNext) {
      toast({ title: "Bid too low", description: `Minimum next bid is $${minNext.toLocaleString()}.`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await bidderSupabase.rpc("place_bid", {
        _item_id: item.id,
        _amount: numeric,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        const errorMessages: Record<string, string> = {
          not_signed_in: "Please sign in to bid.",
          profile_not_set_up: "Finish your one-time setup before bidding.",
          payment_method_missing: "Please add a card to your account before bidding.",
          item_not_found: "This item is no longer available.",
          item_not_open: "Bidding on this item has closed.",
          auction_not_live: "The auction isn't open yet.",
          bidding_not_open_yet: "Bidding hasn't started yet.",
          bidding_closed: "Bidding on this item has closed.",
          bid_too_low: `Minimum next bid is $${result.min_next?.toLocaleString?.() || "higher"}.`,
        };
        const msg = errorMessages[result?.error] || "Bid rejected.";
        toast({ title: "Bid not placed", description: msg, variant: "destructive" });
        return;
      }
      toast({
        title: `Bid placed: $${numeric.toLocaleString()}`,
        description: result.extended ? "Timer extended — a late bid added extra seconds." : undefined,
      });
      // Fire-and-forget outbid SMS to the person we just topped. Graceful no-op
      // if Twilio isn't configured or the previous bidder opted out.
      if (result.bid_id) {
        void bidderSupabase.functions.invoke("auction-send-outbid-sms", {
          body: { bid_id: result.bid_id },
        });
      }
      onBidPlaced();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message || "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  const numericAmount = Number(amount) || 0;
  const receipt = potentialReceipt(numericAmount, item.market_value);
  const receiptThreshold = Math.ceil((item.market_value / 0.8) + 0.01);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Place a bid</DialogTitle>
          <DialogDescription>{item.title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Current bid</div>
              <div className="font-heading font-bold text-lg">
                {bidLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : effectiveBid != null ? (
                  `$${effectiveBid.toLocaleString()}`
                ) : (
                  "No bids yet"
                )}
              </div>
            </div>
            <div className="bg-muted/40 rounded p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Retail value</div>
              <div className="font-heading font-bold text-lg">${item.market_value.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bid-amount">Your bid (CAD)</Label>
            <Input
              id="bid-amount"
              type="number"
              step="1"
              min={minNext}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimum next bid: ${minNext.toLocaleString()} (${increment} increment)
            </p>
          </div>

          {!bidderAttending && item.pickup_option === "thursday_dinner" && (
            <div className="rounded bg-destructive/5 border border-destructive/20 p-3 text-sm text-foreground/80">
              <strong>Heads up:</strong> this item's primary pickup is Thursday dinner. Since you're
              not attending, we'll reach out to arrange an alternative (pickup in Brandon or shipping
              at your cost) if you win.
            </div>
          )}

          {numericAmount > 0 && (
            <div className="rounded bg-accent/10 border border-accent/20 p-3 text-sm space-y-1">
              {receipt > 0 ? (
                <p className="text-foreground/80">
                  <strong>${receipt.toLocaleString()}</strong> of this bid may be eligible for a tax receipt*
                  (the portion above retail value).
                </p>
              ) : (
                <p className="text-foreground/70">
                  Bids of <strong>${receiptThreshold.toLocaleString()}</strong> or more may be eligible for a partial tax receipt*.
                </p>
              )}
              <p className="text-xs text-foreground/50">
                *Issued by ATCP under CRA's split-receipting rules, subject to their review.
              </p>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gavel className="h-4 w-4 mr-2" />}
            {submitting ? "Placing…" : `Bid $${numericAmount.toLocaleString()}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
