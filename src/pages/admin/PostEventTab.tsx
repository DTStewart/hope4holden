import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Users, Mail } from "lucide-react";

const RECIPIENT_GROUPS = [
  { value: "all_attendees", label: "All paid attendees (teams + sponsors + dinner tickets)" },
  { value: "registrations", label: "Team captains (paid registrations)" },
  { value: "sponsors", label: "Sponsors (paid)" },
  { value: "donations", label: "Donors (paid donations)" },
  { value: "dinners", label: "Dinner ticket holders (paid)" },
];

type FundraisingTotal = {
  total_raised: number;
  teams_count: number;
  sponsors_total: number;
  donations_total: number;
  dinners_total: number;
};

export default function PostEventTab() {
  const { toast } = useToast();

  const { data: autoTotal } = useQuery<FundraisingTotal>({
    queryKey: ["admin-fundraising-total"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase.rpc("get_fundraising_total");
      if (error) throw error;
      return data as unknown as FundraisingTotal;
    },
  });

  const [recipientGroup, setRecipientGroup] = useState("all_attendees");
  const [subject, setSubject] = useState("Together we raised it — thank you");
  const [totalRaised, setTotalRaised] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Seed totalRaised once the auto value arrives, if the user hasn't typed yet.
  useEffect(() => {
    if (autoTotal && totalRaised === "") {
      setTotalRaised(String(autoTotal.total_raised));
    }
  }, [autoTotal, totalRaised]);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data, error } = await adminSupabase.functions.invoke("admin-bulk-email", {
        body: { recipientGroup, dryRun: true },
      });
      if (error) throw error;
      setPreviewCount((data as { count?: number })?.count ?? 0);
    } catch (err) {
      toast({ title: "Failed to check count", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const send = useMutation({
    mutationFn: async () => {
      const total = Number(totalRaised);
      if (!Number.isFinite(total) || total < 0) throw new Error("Enter a valid total raised");
      const saveTheDateUrl = `${window.location.origin}/save-the-date`;

      const { data, error } = await adminSupabase.functions.invoke("admin-bulk-email", {
        body: {
          recipientGroup,
          templateName: "event-recap",
          subject,
          templateData: {
            subject,
            totalRaised: total,
            photoUrl: photoUrl.trim() || undefined,
            videoUrl: videoUrl.trim() || undefined,
            customMessage: customMessage.trim() || undefined,
            saveTheDateUrl,
          },
        },
      });
      if (error) throw error;
      return data as { queued: number; failed: number; total: number; runId: string };
    },
    onSuccess: (data) => {
      toast({
        title: `Queued ${data.queued} of ${data.total} recap emails`,
        description:
          data.failed > 0
            ? `${data.failed} failed to queue — check edge function logs for run ${data.runId}.`
            : "They'll deliver over the next few minutes.",
      });
      setPreviewCount(null);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Post-event recap email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pe-group">Recipients</Label>
            <Select
              value={recipientGroup}
              onValueChange={(v) => { setRecipientGroup(v); setPreviewCount(null); }}
            >
              <SelectTrigger id="pe-group"><SelectValue /></SelectTrigger>
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
            <Label htmlFor="pe-subject">Subject</Label>
            <Input id="pe-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pe-total">Total raised (pre-filled from DB — editable)</Label>
            <Input
              id="pe-total"
              type="number"
              min={0}
              value={totalRaised}
              onChange={(e) => setTotalRaised(e.target.value)}
              placeholder="47200"
            />
            {autoTotal && (
              <p className="text-xs text-muted-foreground">
                Auto total: ${autoTotal.total_raised.toLocaleString("en-CA")} · {autoTotal.teams_count} teams,
                ${autoTotal.sponsors_total.toLocaleString("en-CA")} sponsors,
                ${autoTotal.donations_total.toLocaleString("en-CA")} donations,
                ${autoTotal.dinners_total.toLocaleString("en-CA")} dinner tickets.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pe-photo">Photo URL (optional)</Label>
              <Input
                id="pe-photo"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…/event-photo.jpg"
              />
              <p className="text-xs text-muted-foreground">Paste a public URL — e.g., from the Gallery bucket or an approved UGC photo.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pe-video">Video URL (optional)</Label>
              <Input
                id="pe-video"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtu.be/…"
              />
              <p className="text-xs text-muted-foreground">Link shown as a button in the email.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pe-msg">Custom message (optional)</Label>
            <Textarea
              id="pe-msg"
              rows={6}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="What do you want attendees to remember? Stories, specific highlights, anything personal from Holden's family."
            />
            <p className="text-xs text-muted-foreground">
              Blank lines = paragraphs. The template already includes a thank-you opener and save-the-date CTA.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={send.isPending || !totalRaised || !subject.trim()}
                className="w-full"
                size="lg"
              >
                {send.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  : <Send className="h-4 w-4 mr-2" />}
                {send.isPending ? "Sending..." : "Send recap email"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Send the recap?</AlertDialogTitle>
                <AlertDialogDescription>
                  {previewCount !== null
                    ? `This will send to ${previewCount} recipient${previewCount === 1 ? "" : "s"}. Can't be undone.`
                    : "This will send to everyone in the selected group. Can't be undone."}
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
    </div>
  );
}
