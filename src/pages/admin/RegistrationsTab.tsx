import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Mail, Loader2, UserPlus, Link as LinkIcon, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForRegistration } from "@/lib/resendOrderConfirmation";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

const PRICE_PER_GOLFER = 150;

interface Registration {
  id: string;
  team_name: string;
  captain_name: string;
  captain_email: string;
  captain_phone: string;
  captain_address?: string | null;
  captain_city?: string | null;
  captain_province?: string | null;
  captain_postal_code?: string | null;
  status: string;
  paid: boolean;
  is_extra_golfers: boolean;
  golfer_count: number | null;
  golfing_with: string | null;
  team_members?: any;
  team_size: number;
  created_at: string;
}

function TeamSizeCell({ reg }: { reg: Registration }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(reg.team_size ?? 4));
  const [saving, setSaving] = useState(false);
  const named = Array.isArray(reg.team_members)
    ? reg.team_members.filter((m: any) => m && (m.name?.trim?.() || "")).length
    : 0;

  const save = async () => {
    if (saving) return;
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 1 || n > 20) {
      toast({ title: "Invalid team size", description: "Enter a number 1–20.", variant: "destructive" });
      setDraft(String(reg.team_size));
      setEditing(false);
      return;
    }
    if (n === reg.team_size) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await adminSupabase.from("registrations").update({ team_size: n }).eq("id", reg.id);
    setSaving(false);
    setEditing(false);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      setDraft(String(reg.team_size));
    } else {
      toast({ title: "Team size updated" });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
    }
  };

  if (editing) {
    return (
      <Input
        type="number"
        min={1}
        max={20}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setDraft(String(reg.team_size)); setEditing(false); }
        }}
        disabled={saving}
        className="h-7 w-20"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left hover:underline whitespace-nowrap"
      title="Click to edit team size"
    >
      {reg.team_size ?? 4} <span className="text-muted-foreground">({named} named)</span>
    </button>
  );
}


export default function RegistrationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  // Extra-golfer link generator state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [golferCount, setGolferCount] = useState<number>(1);
  const [golfingWith, setGolfingWith] = useState<string>("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleResend = async (reg: Registration) => {
    setResendingId(reg.id);
    try {
      await resendForRegistration(reg as any);
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
      const { data, error } = await adminSupabase
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
    queryKey: ["admin-registrations", yearFilter],
    enabled: yearFilter != null,
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("registrations")
        .select("*")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Registration[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      toast({ title: "Registration deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      toast({ title: "All registrations deleted" });
    },
  });

  const columns = useMemo<ColumnDef<Registration>[]>(() => [
    {
      accessorKey: "team_name",
      header: "Team / Type",
      cell: ({ row }) => {
        const reg = row.original;
        return (
          <div className="font-medium">
            <div>{reg.team_name}</div>
            {reg.is_extra_golfers && (
              <div className="mt-1 space-y-1">
                <Badge variant="secondary" className="text-xs">
                  Extra golfers ({reg.golfer_count})
                </Badge>
                {reg.golfing_with && (
                  <div className="text-xs text-muted-foreground font-normal">
                    Golfing with: <span className="font-medium">{reg.golfing_with}</span>
                  </div>
                )}
                {Array.isArray(reg.team_members) && reg.team_members.length > 0 && (
                  <div className="text-xs text-muted-foreground font-normal">
                    {reg.team_members.map((m: any) => m?.name).filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    { accessorKey: "captain_name", header: "Captain" },
    {
      accessorKey: "captain_email",
      header: "Email",
      cell: ({ row }) => (
        <EditableEmail
          table="registrations"
          id={row.original.id}
          column="captain_email"
          value={row.original.captain_email}
          invalidateKey={["admin-registrations"]}
        />
      ),
    },
    { accessorKey: "captain_phone", header: "Phone" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "confirmed" ? "default" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "paid",
      header: "Paid",
      cell: ({ row }) => (
        <Badge variant={row.original.paid ? "default" : "destructive"}>
          {row.original.paid ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const reg = row.original;
        return (
          <div className="space-x-1 whitespace-nowrap">
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
          </div>
        );
      },
    },
  ], [resendingId, deleteOne]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Team Registrations ({registrations?.length ?? 0})</span>
          <div className="flex gap-2 flex-wrap items-center">
            <YearFilter table="registrations" value={yearFilter} onChange={setYearFilter} />
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
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AdminDataTable<Registration>
          data={registrations ?? []}
          columns={columns}
          urlStateKey="registrations"
          searchPlaceholder="Search team, captain, email…"
          searchKeys={["team_name", "captain_name", "captain_email", "captain_phone", "golfing_with"]}
          initialSort={{ id: "created_at", desc: true }}
          emptyMessage="No registrations yet."
          exportFilename="registrations"
        />
      </CardContent>
    </Card>
  );
}
