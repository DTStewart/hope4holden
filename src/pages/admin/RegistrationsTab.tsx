import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, Mail, Loader2, UserPlus, Link as LinkIcon, Copy } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForRegistration } from "@/lib/resendOrderConfirmation";
import { useState } from "react";

const PRICE_PER_GOLFER = 150;

export default function RegistrationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Extra-golfer link generator state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [golferCount, setGolferCount] = useState<number>(1);
  const [golfingWith, setGolfingWith] = useState<string>("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleResend = async (reg: any) => {
    setResendingId(reg.id);
    try {
      await resendForRegistration(reg);
      toast({ title: "Confirmation email sent", description: `Sent to ${reg.captain_email}` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const handleGenerateLink = async () => {
    if (golferCount < 1 || golferCount > 8) {
      toast({ title: "Pick between 1 and 8 golfers", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from("extra_golfer_invites")
        .insert({
          golfer_count: golferCount,
          golfing_with: golfingWith.trim() || null,
          price_per_golfer: PRICE_PER_GOLFER * 100,
        })
        .select("token")
        .single();
      if (error) throw error;
      const url = `${window.location.origin}/extra-golfer/${data.token}`;
      setGeneratedUrl(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Link generated and copied to clipboard" });
    } catch (err: any) {
      toast({ title: "Could not generate link", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const resetLinkDialog = () => {
    setGolferCount(1);
    setGolfingWith("");
    setGeneratedUrl(null);
  };

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      toast({ title: "Registration deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      toast({ title: "All registrations deleted" });
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Team Registrations ({registrations?.length ?? 0})</span>
          <div className="flex gap-2 flex-wrap">
            <Dialog
              open={linkDialogOpen}
              onOpenChange={(open) => {
                setLinkDialogOpen(open);
                if (!open) resetLinkDialog();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-4 w-4 mr-1" /> Extra Golfer Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate Extra Golfer Payment Link</DialogTitle>
                  <DialogDescription>
                    Creates a link the recipient can use to pay for extra golfers added to a team.
                    ${PRICE_PER_GOLFER} per golfer.
                  </DialogDescription>
                </DialogHeader>

                {!generatedUrl ? (
                  <div className="space-y-4 py-2">
                    <div>
                      <Label htmlFor="golferCount">Number of golfers *</Label>
                      <Input
                        id="golferCount"
                        type="number"
                        min={1}
                        max={8}
                        value={golferCount}
                        onChange={(e) => setGolferCount(Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Total: ${golferCount * PRICE_PER_GOLFER}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="golfingWith">Which team are they joining? (optional)</Label>
                      <Input
                        id="golfingWith"
                        value={golfingWith}
                        onChange={(e) => setGolfingWith(e.target.value)}
                        placeholder="e.g. The Birdies, John Smith's team"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Pre-fills on their page so they don't have to know. Leave blank to let them tell us.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-2">
                    <Label>Payment link (already copied to your clipboard)</Label>
                    <div className="flex gap-2">
                      <Input value={generatedUrl} readOnly onFocus={(e) => e.target.select()} />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedUrl);
                          toast({ title: "Copied!" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send this to the recipient by text or email. The link works once.
                    </p>
                  </div>
                )}

                <DialogFooter>
                  {!generatedUrl ? (
                    <>
                      <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleGenerateLink} disabled={generating}>
                        {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                        Generate Link
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setLinkDialogOpen(false)}>Done</Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {registrations && registrations.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportToCsv("registrations.csv",
                      ["Team Name", "Captain", "Email", "Phone", "Address", "City", "Province", "Postal Code", "Status", "Paid", "Extra Golfers", "Golfing With", "Date"],
                      registrations.map((r: any) => [
                        r.team_name, r.captain_name, r.captain_email, r.captain_phone,
                        r.captain_address || "", r.captain_city || "", r.captain_province || "", r.captain_postal_code || "",
                        r.status, r.paid ? "Yes" : "No",
                        r.is_extra_golfers ? `Yes (${r.golfer_count || ""})` : "No",
                        r.golfing_with || "",
                        new Date(r.created_at).toLocaleDateString(),
                      ])
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all registrations?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all {registrations.length} registration(s). This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteAll.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {registrations?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No registrations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team / Type</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations?.map((reg: any) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">
                      <div>{reg.team_name}</div>
                      {reg.is_extra_golfers && (
                        <div className="mt-1 space-y-1">
                          <Badge variant="secondary" className="text-xs">
                            Extra golfers ({reg.golfer_count})
                          </Badge>
                          {reg.golfing_with && (
                            <div className="text-xs text-muted-foreground">
                              Golfing with: <span className="font-medium">{reg.golfing_with}</span>
                            </div>
                          )}
                          {Array.isArray(reg.team_members) && reg.team_members.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {reg.team_members.map((m: any) => m?.name).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{reg.captain_name}</TableCell>
                    <TableCell>
                      <EditableEmail
                        table="registrations"
                        id={reg.id}
                        column="captain_email"
                        value={reg.captain_email}
                        invalidateKey={["admin-registrations"]}
                      />
                    </TableCell>
                    <TableCell>{reg.captain_phone}</TableCell>
                    <TableCell>
                      <Badge variant={reg.status === "confirmed" ? "default" : "secondary"}>
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={reg.paid ? "default" : "destructive"}>
                        {reg.paid ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(reg.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Resend order confirmation"
                        disabled={resendingId === reg.id}
                        onClick={() => handleResend(reg)}
                      >
                        {resendingId === reg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne.mutate(reg.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
