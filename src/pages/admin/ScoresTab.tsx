import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Check, X, Copy, Loader2, ExternalLink, Pencil, Camera, Plus, Upload } from "lucide-react";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

type Submission = {
  id: string;
  registration_id: string;
  final_score: number;
  photo_url: string;
  submitter_note: string | null;
  verified: boolean;
  disqualified: boolean;
  admin_note: string | null;
  created_at: string;
  registrations: {
    team_name: string;
    business_name: string | null;
    captain_email: string;
    score_token: string;
  } | null;
};

type TeamRow = {
  id: string;
  team_name: string;
  business_name: string | null;
  captain_name: string;
  captain_email: string;
  score_token: string;
  paid: boolean;
  submission?: Submission;
  // Flattened for sort/search
  final_score?: number | null;
  status_label?: string;
};

export default function ScoresTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [entryTeam, setEntryTeam] = useState<TeamRow | null>(null);
  const [entryMode, setEntryMode] = useState<"create" | "replace_photo">("create");

  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ["admin-scorecards"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("scorecard_submissions")
        .select("*, registrations(team_name, business_name, captain_email, score_token)")
        .order("final_score", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Submission[];
    },
  });

  const { data: teams } = useQuery<TeamRow[]>({
    queryKey: ["admin-paid-teams"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("registrations")
        .select("id, team_name, business_name, captain_name, captain_email, score_token, paid")
        .eq("paid", true)
        .order("team_name");
      if (error) throw error;
      return (data || []) as TeamRow[];
    },
  });

  const verify = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { error } = await supabase
        .from("scorecard_submissions")
        .update({ verified, disqualified: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scorecards"] });
      toast({ title: "Updated" });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const disqualify = useMutation({
    mutationFn: async ({ id, disqualified }: { id: string; disqualified: boolean }) => {
      const { error } = await supabase
        .from("scorecard_submissions")
        .update({ disqualified, verified: disqualified ? false : undefined })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scorecards"] });
      toast({ title: "Updated" });
    },
  });

  const updateScore = useMutation({
    mutationFn: async ({ id, score }: { id: string; score: number }) => {
      const { error } = await supabase
        .from("scorecard_submissions")
        .update({ final_score: score })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-scorecards"] });
      setEditingId(null);
      toast({ title: "Score updated" });
    },
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/score/${token}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied" }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  const openEntry = (team: TeamRow, mode: "create" | "replace_photo") => {
    setEntryMode(mode);
    setEntryTeam(team);
  };

  const handleEntrySaved = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-scorecards"] });
    setEntryTeam(null);
  };

  // Join submissions into teams with flattened sort/search fields
  const submissionByReg = useMemo(
    () => new Map<string, Submission>((submissions || []).map((s) => [s.registration_id, s])),
    [submissions]
  );

  const rows: TeamRow[] = useMemo(() => {
    return (teams || []).map((t) => {
      const sub = submissionByReg.get(t.id);
      const status_label = !sub
        ? "Not submitted"
        : sub.disqualified
        ? "Disqualified"
        : sub.verified
        ? "Verified"
        : "Pending review";
      return {
        ...t,
        submission: sub,
        final_score: sub?.final_score ?? null,
        status_label,
      };
    });
  }, [teams, submissionByReg]);

  const submitted = rows.filter((r) => r.submission).length;
  const verified = (submissions || []).filter((s) => s.verified && !s.disqualified).length;

  const columns = useMemo<ColumnDef<TeamRow>[]>(() => [
    {
      accessorKey: "team_name",
      header: "Team",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.team_name}</div>
          {row.original.business_name && row.original.business_name !== row.original.team_name && (
            <div className="text-xs text-muted-foreground">{row.original.business_name}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: "captain_name",
      header: "Captain",
      cell: ({ row }) => (
        <div className="text-xs">
          {row.original.captain_name}
          <div className="text-muted-foreground">{row.original.captain_email}</div>
        </div>
      ),
    },
    {
      id: "photo",
      header: "Photo",
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original.submission;
        return s?.photo_url ? (
          <a
            href={s.photo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block h-10 w-10 rounded overflow-hidden border border-border"
          >
            <img src={s.photo_url} alt="" className="h-full w-full object-cover" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "final_score",
      header: "Score",
      sortUndefined: "last",
      cell: ({ row }) => {
        const s = row.original.submission;
        if (!s) return <span className="text-muted-foreground text-xs">No submission</span>;
        if (editingId === s.id) {
          return (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 w-20 text-right"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={() => updateScore.mutate({ id: s.id, score: Number(editValue) })}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        }
        return (
          <button
            type="button"
            onClick={() => { setEditingId(s.id); setEditValue(String(s.final_score)); }}
            className="inline-flex items-center gap-1 font-heading font-bold text-lg hover:text-primary"
            title="Edit score"
          >
            {s.final_score}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        );
      },
    },
    {
      accessorKey: "status_label",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.submission;
        if (!s) return <Badge variant="outline">Not submitted</Badge>;
        if (s.disqualified) return <Badge variant="destructive">Disqualified</Badge>;
        if (s.verified) return <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">Verified</Badge>;
        return <Badge variant="secondary">Pending review</Badge>;
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        const s = r.submission;
        return (
          <div className="flex gap-1 justify-end">
            {!s && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => openEntry(r, "create")}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Enter
              </Button>
            )}
            {s && (
              <Button
                size="sm"
                variant="ghost"
                title="Replace photo"
                onClick={() => openEntry(r, "replace_photo")}
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              title="Copy scorecard link"
              onClick={() => copyLink(r.score_token)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Open scorecard page"
              asChild
            >
              <a href={`/score/${r.score_token}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            {s && !s.verified && !s.disqualified && (
              <Button
                size="sm"
                variant="ghost"
                title="Verify"
                className="text-primary"
                disabled={verify.isPending}
                onClick={() => verify.mutate({ id: s.id, verified: true })}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {s && (
              <Button
                size="sm"
                variant="ghost"
                title={s.disqualified ? "Un-disqualify" : "Disqualify"}
                className="text-destructive"
                disabled={disqualify.isPending}
                onClick={() => disqualify.mutate({ id: s.id, disqualified: !s.disqualified })}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ], [editingId, editValue, verify, disqualify, updateScore]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Teams</div>
          <div className="font-heading font-extrabold text-2xl">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Submitted</div>
          <div className="font-heading font-extrabold text-2xl">{submitted}</div>
        </Card>
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Verified</div>
          <div className="font-heading font-extrabold text-2xl text-primary">{verified}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Scorecards
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!rows.length ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <AdminDataTable<TeamRow>
              data={rows}
              columns={columns}
              urlStateKey="scores"
              searchPlaceholder="Search team, captain, email…"
              searchKeys={["team_name", "business_name", "captain_name", "captain_email", "status_label"]}
              initialSort={{ id: "final_score", desc: false }}
              emptyMessage="No teams yet."
              exportFilename="scores"
            />
          )}
        </CardContent>
      </Card>

      {entryTeam && (
        <AdminScoreEntryDialog
          team={entryTeam}
          mode={entryMode}
          existingSubmissionId={submissionByReg.get(entryTeam.id)?.id}
          onClose={() => setEntryTeam(null)}
          onSaved={handleEntrySaved}
        />
      )}
    </div>
  );
}

function AdminScoreEntryDialog({
  team,
  mode,
  existingSubmissionId,
  onClose,
  onSaved,
}: {
  team: TeamRow;
  mode: "create" | "replace_photo";
  existingSubmissionId: string | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please keep it under 10 MB.", variant: "destructive" });
      return;
    }
    setPhoto(f);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const uploadPhoto = async (): Promise<string> => {
    if (!photo) throw new Error("No photo selected");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(
      `${supabaseUrl}/functions/v1/scorecard-upload?token=${encodeURIComponent(team.score_token)}&filename=${encodeURIComponent(photo.name)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": photo.type,
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: photo,
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Photo upload failed");
    }
    const { url } = await res.json();
    return url;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) {
      toast({ title: "Add a photo", variant: "destructive" });
      return;
    }
    if (mode === "create") {
      const numeric = Number(score);
      if (!numeric || numeric <= 0 || numeric >= 300) {
        toast({ title: "Score looks off", variant: "destructive" });
        return;
      }
    }
    setSubmitting(true);
    try {
      const photoUrl = await uploadPhoto();

      if (mode === "create") {
        const { error } = await supabase.from("scorecard_submissions").insert({
          registration_id: team.id,
          final_score: Number(score),
          photo_url: photoUrl,
          submitter_note: note.trim() || null,
          verified: true, // admin-entered, trusted by default
          admin_note: "Entered by admin",
        });
        if (error) throw error;
        toast({ title: "Score saved", description: `${team.team_name}: ${score}` });
      } else {
        if (!existingSubmissionId) throw new Error("No existing submission to replace photo for");
        const { error } = await supabase
          .from("scorecard_submissions")
          .update({ photo_url: photoUrl })
          .eq("id", existingSubmissionId);
        if (error) throw error;
        toast({ title: "Photo replaced" });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? `Enter score for ${team.team_name}` : `Replace photo for ${team.team_name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Admin-entered scores are auto-verified."
              : "Upload a new scorecard photo."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="adm-score">Final score</Label>
                <Input
                  id="adm-score"
                  type="number"
                  min={1}
                  max={299}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adm-note">Note (optional)</Label>
                <Textarea
                  id="adm-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Any context — who submitted, special rules, etc."
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="adm-photo">Scorecard photo</Label>
            <label
              htmlFor="adm-photo"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="max-h-48 rounded" />
              ) : (
                <>
                  <Camera className="h-7 w-7 text-muted-foreground mb-1" />
                  <span className="text-sm text-muted-foreground">Tap to take or upload</span>
                  <span className="text-xs text-muted-foreground/70 mt-0.5">PNG / JPG / HEIC, max 10 MB</span>
                </>
              )}
            </label>
            <input
              id="adm-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhotoSelect}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !photo}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {mode === "create" ? "Save score" : "Replace photo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
