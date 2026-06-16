import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type Donation = {
  id: string;
  donor_name: string;
  public_display_consent?: boolean | null;
  public_display_name?: string | null;
};

type Props = {
  donation: Donation | null;
  onOpenChange: (open: boolean) => void;
};

export default function EditDonationDisplayDialog({ donation, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [consent, setConsent] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (donation) {
      setConsent(!!donation.public_display_consent);
      setDisplayName(donation.public_display_name ?? donation.donor_name ?? "");
    }
  }, [donation]);

  const save = useMutation({
    mutationFn: async () => {
      if (!donation) return;
      const { error } = await adminSupabase
        .from("donations")
        .update({
          public_display_consent: consent,
          public_display_name: consent ? (displayName.trim() || donation.donor_name) : null,
        })
        .eq("id", donation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      toast({ title: "Display settings updated" });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={!!donation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit public display</DialogTitle>
          <DialogDescription>
            Controls how this donor appears on the public supporters ticker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ed-consent"
              checked={consent}
              onCheckedChange={(v) => {
                const checked = v === true;
                setConsent(checked);
                if (checked && !displayName.trim() && donation) {
                  setDisplayName(donation.donor_name);
                }
              }}
            />
            <Label htmlFor="ed-consent" className="text-sm font-normal cursor-pointer">
              Display this donor publicly on the supporters ticker
            </Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ed-display-name" className="text-xs text-muted-foreground">
              Public display name
            </Label>
            <Input
              id="ed-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={donation?.donor_name || "Donor name"}
              disabled={!consent}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
