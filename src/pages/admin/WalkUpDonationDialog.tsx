import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign } from "lucide-react";

type Method = "cash" | "cheque" | "eft" | "other";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function WalkUpDonationDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("cheque");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [note, setNote] = useState("");
  const [sendThankYou, setSendThankYou] = useState(true);

  const reset = () => {
    setName(""); setEmail(""); setAmount(""); setMethod("cheque");
    setAddress(""); setCity(""); setProvince(""); setPostalCode("");
    setNote(""); setSendThankYou(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const amt = Math.round(Number(amount));
      if (!name.trim()) throw new Error("Name is required");
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a positive whole-dollar amount");

      const { data, error } = await adminSupabase
        .from("donations")
        .insert({
          donor_name: name.trim(),
          donor_email: email.trim() || `walkup-${Date.now()}@hope4holden.local`,
          amount: amt,
          paid: true,
          wants_recurring: false,
          donor_address: address.trim() || null,
          donor_city: city.trim() || null,
          donor_province: province.trim() || null,
          donor_postal_code: postalCode.trim() || null,
          method,
          admin_note: note.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (sendThankYou && email.trim()) {
        try {
          await adminSupabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "donation-thank-you-manual",
              recipientEmail: email.trim(),
              idempotencyKey: `walkup-thankyou-${data.id}`,
              templateData: {
                donorName: name.trim(),
                amount: amt,
                method,
                note: note.trim() || undefined,
              },
            },
          });
        } catch (err) {
          console.warn("[WalkUp] thank-you email failed:", err);
          toast({
            title: "Donation saved, email failed",
            description: "Check edge function logs — the donation is recorded.",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-stats"] });
      toast({ title: "Donation saved" });
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Add walk-up donation
          </DialogTitle>
          <DialogDescription>
            Cash, cheque, or e-transfer. Recorded as paid, tagged with the method so it's
            distinguishable from Stripe donations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label htmlFor="wu-name">Donor name *</Label>
              <Input id="wu-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="wu-email">Email (optional — required for thank-you email)</Label>
              <Input id="wu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wu-amount">Amount *</Label>
              <Input id="wu-amount" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wu-method">Method *</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger id="wu-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="eft">E-transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Optional: mailing address (for tax receipts)
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="space-y-1 col-span-2">
                <Label htmlFor="wu-addr">Street address</Label>
                <Input id="wu-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wu-city">City</Label>
                <Input id="wu-city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wu-prov">Province</Label>
                <Input id="wu-prov" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="ON" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wu-pc">Postal code</Label>
                <Input id="wu-pc" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="A1A 1A1" />
              </div>
            </div>
          </details>

          <div className="space-y-1">
            <Label htmlFor="wu-note">Note (internal)</Label>
            <Textarea
              id="wu-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Received at Thursday dinner, cheque #2041"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="wu-send"
              checked={sendThankYou}
              onCheckedChange={(v) => setSendThankYou(v === true)}
            />
            <Label htmlFor="wu-send" className="text-sm font-normal cursor-pointer">
              Send a thank-you email now {email.trim() ? "" : "(enter an email above)"}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim() || !amount}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save donation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
