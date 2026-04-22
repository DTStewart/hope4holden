import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Users } from "lucide-react";

const RECIPIENT_GROUPS = [
  { value: "all_attendees", label: "All paid attendees (teams + sponsors + dinner tickets)" },
  { value: "registrations", label: "Team captains (paid registrations)" },
  { value: "sponsors", label: "Sponsors (paid)" },
  { value: "donations", label: "Donors (paid donations)" },
  { value: "dinners", label: "Dinner ticket holders (paid)" },
  { value: "subscribers", label: "Newsletter subscribers" },
];

export default function BulkEmailTab() {
  const { toast } = useToast();
  const [recipientGroup, setRecipientGroup] = useState("all_attendees");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-bulk-email", {
        body: { recipientGroup, dryRun: true },
      });
      if (error) throw error;
      setPreviewCount((data as any)?.count ?? 0);
    } catch (err: any) {
      toast({ title: "Failed to check count", description: err.message || "Try again.", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-bulk-email", {
        body: { recipientGroup, subject, body },
      });
      if (error) throw error;
      return data as { queued: number; failed: number; total: number; runId: string };
    },
    onSuccess: (data) => {
      toast({
        title: `Queued ${data.queued} of ${data.total} emails`,
        description:
          data.failed > 0
            ? `${data.failed} failed to queue — check edge function logs for run ${data.runId}.`
            : "They'll deliver over the next few minutes.",
      });
      setSubject("");
      setBody("");
      setPreviewCount(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message || "Try again.", variant: "destructive" });
    },
  });

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !send.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Bulk Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="group">Recipients</Label>
          <Select
            value={recipientGroup}
            onValueChange={(v) => { setRecipientGroup(v); setPreviewCount(null); }}
          >
            <SelectTrigger id="group"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECIPIENT_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
            <Button type="button" variant="outline" size="sm" onClick={loadPreview} disabled={loadingPreview}>
              {loadingPreview
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <Users className="h-3 w-3 mr-1" />}
              Check count
            </Button>
            {previewCount !== null && (
              <span>{previewCount} recipient{previewCount === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Weather update for the tournament"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi team!\n\nQuick update on the forecast for Thursday..."}
            rows={10}
          />
          <p className="text-xs text-muted-foreground">
            The recipient's name is added automatically as &ldquo;Hi [Name],&rdquo; at the top.
            Use a blank line to separate paragraphs. Recipients who have unsubscribed won't receive this.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!canSend} className="w-full" size="lg">
              {send.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Send className="h-4 w-4 mr-2" />}
              {send.isPending ? "Sending..." : "Send to recipients"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email?</AlertDialogTitle>
              <AlertDialogDescription>
                {previewCount !== null
                  ? `This will send to ${previewCount} recipient${previewCount === 1 ? "" : "s"}. This can't be undone.`
                  : "This will send to everyone in the selected group. This can't be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => send.mutate()}>Send</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
