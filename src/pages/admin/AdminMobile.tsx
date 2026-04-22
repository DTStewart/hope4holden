import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import WalkUpDonationDialog from "./WalkUpDonationDialog";
import { DollarSign, MessageSquare, Trophy, LogOut, Monitor, Loader2, Send } from "lucide-react";

const RECIPIENT_GROUPS = [
  { value: "all_attendees", label: "All attendees" },
  { value: "registrations", label: "Team captains" },
  { value: "sponsors", label: "Sponsors" },
  { value: "dinners", label: "Dinner guests" },
  { value: "bidders", label: "Auction bidders" },
];

export default function AdminMobile() {
  const { signOut } = useAuth();
  const [donationOpen, setDonationOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-extrabold text-xl text-foreground">Admin · Mobile</h1>
          <p className="text-xs text-muted-foreground">Quick actions</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="space-y-3 max-w-md mx-auto">
        <Button
          size="lg"
          className="w-full h-24 text-lg justify-start"
          onClick={() => setDonationOpen(true)}
        >
          <DollarSign className="h-7 w-7 mr-3" />
          Walk-up donation
        </Button>

        <Button
          size="lg"
          variant="secondary"
          className="w-full h-24 text-lg justify-start"
          asChild
        >
          <Link to="/admin?tab=scores">
            <Trophy className="h-7 w-7 mr-3" />
            Enter team score
          </Link>
        </Button>

        <Button
          size="lg"
          variant="secondary"
          className="w-full h-24 text-lg justify-start"
          onClick={() => setSmsOpen(true)}
        >
          <MessageSquare className="h-7 w-7 mr-3" />
          Send SMS alert
        </Button>

        <div className="pt-4 space-y-2 border-t border-border mt-6">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to="/live" target="_blank">
              <Monitor className="h-4 w-4 mr-2" />
              Open live dashboard
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              sessionStorage.setItem("skip-admin-mobile-redirect", "1");
              window.location.href = "/admin";
            }}
          >
            Full admin (desktop view)
          </Button>
        </div>
      </div>

      <WalkUpDonationDialog open={donationOpen} onOpenChange={setDonationOpen} />
      <SmsAlertDialog open={smsOpen} onOpenChange={setSmsOpen} />
    </div>
  );
}

function SmsAlertDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [recipientGroup, setRecipientGroup] = useState("all_attendees");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const checkCount = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-bulk-sms", {
        body: { recipientGroup, dryRun: true },
      });
      if (error) throw error;
      setCount((data as { count?: number })?.count ?? 0);
    } catch (err) {
      toast({
        title: "Couldn't check count",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-bulk-sms", {
        body: { recipientGroup, message },
      });
      if (error) throw error;
      return data as { sent: number; failed: number; total: number };
    },
    onSuccess: (data) => {
      toast({
        title: `SMS sent: ${data.sent}/${data.total}`,
        description: data.failed > 0 ? `${data.failed} failed — check logs.` : undefined,
      });
      setMessage("");
      setCount(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS alert
          </DialogTitle>
          <DialogDescription>
            Broadcast a text message. Requires Twilio configured; uses numbers already on file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Recipients</Label>
            <Select value={recipientGroup} onValueChange={(v) => { setRecipientGroup(v); setCount(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RECIPIENT_GROUPS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={checkCount} disabled={checking}>
                {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check count"}
              </Button>
              {count !== null && <span className="text-xs text-muted-foreground">{count} phone number{count === 1 ? "" : "s"}</span>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sms-msg">Message (max 320 chars)</Label>
            <Textarea
              id="sms-msg"
              rows={4}
              value={message}
              maxLength={320}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Dinner starts 10 min early — head to the patio by 6:20."
            />
            <p className="text-xs text-muted-foreground">{message.length}/320 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => send.mutate()}
            disabled={send.isPending || !message.trim()}
          >
            {send.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
