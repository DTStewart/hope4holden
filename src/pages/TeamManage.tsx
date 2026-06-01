import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, Users, Camera, Save, Copy, Trophy, ExternalLink, Plus, X, Upload, ImageIcon,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type TeamMember = {
  name: string;
  email?: string;
  dietary?: string;
  shirt_size?: string;
};

type Team = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  team_slug: string;
  team_members: TeamMember[];
  team_photo_url: string | null;
  captain_name: string;
  captain_email: string;
  team_fundraising_total: number;
};

const MAX_TEAMMATES = 3; // captain + 3 = 4 golfers

export default function TeamManage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "error">("loading");
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    if (!token) { setStatus("invalid"); return; }
    setStatus("loading");
    try {
      const { data, error } = await anonSupabase.rpc("get_team_for_management", { _token: token });
      if (error) throw error;
      const first = Array.isArray(data) ? data[0] : data;
      if (!first) { setStatus("invalid"); return; }
      const t = first as unknown as Team;
      setTeam(t);
      setMembers(Array.isArray(t.team_members) ? t.team_members : []);
      setStatus("ready");
    } catch (err: any) {
      console.error("[TeamManage] load failed:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Couldn't load this team.");
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

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

  const addMember = () => {
    if (members.length >= MAX_TEAMMATES) return;
    setMembers([...members, { name: "", email: "", dietary: "", shirt_size: "" }]);
  };

  const updateMember = (idx: number, patch: Partial<TeamMember>) => {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };

  const removeMember = (idx: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!token || !team) return;
    setSaving(true);
    try {
      let photoUrl: string | null = team.team_photo_url;
      if (photo) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/team-photo-upload?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(photo.name)}`,
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
        const body = await res.json();
        photoUrl = body.url;
      }

      // Keep only members with a name
      const cleanMembers = members
        .map((m) => ({
          name: m.name.trim(),
          email: m.email?.trim() || undefined,
          dietary: m.dietary?.trim() || undefined,
          shirt_size: m.shirt_size?.trim() || undefined,
        }))
        .filter((m) => m.name.length > 0);

      const { error } = await anonSupabase.rpc("update_team_details", {
        _token: token,
        _team_members: cleanMembers,
        _team_photo_url: photoUrl,
      });
      if (error) throw error;

      toast({ title: "Saved" });
      setPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = () => {
    if (!team) return;
    const url = `${window.location.origin}/team/${team.team_slug}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied", description: "Share it with friends & family to raise more." }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  if (status === "loading") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <AlertCircle className="h-14 w-14 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Invalid link</h1>
          <p className="text-foreground/60">This team management link isn't valid.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <AlertCircle className="h-14 w-14 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Something went wrong</h1>
          <p className="text-foreground/60">{errorMsg}</p>
          <Button onClick={load} variant="outline">Try again</Button>
        </div>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-12 md:py-16 animate-fade-in relative z-10">
          <p className="section-label">Manage your team</p>
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight mt-1">
            {team.team_name}
          </h1>
          <p className="text-white/60 mt-2 text-sm">
            Captain: {team.captain_name}
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-10 md:py-14 max-w-2xl space-y-6">

          {/* Public team page link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                Your public team page
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground/70">
                Share this link on social or in email. Every dollar donated via the link counts toward your team's
                fundraising total.
              </p>
              <div className="flex items-center gap-2 bg-muted/40 rounded px-3 py-2 text-sm">
                <code className="text-foreground/80 flex-1 truncate">
                  {window.location.origin}/team/{team.team_slug}
                </code>
                <Button size="sm" variant="outline" onClick={copyPublicLink}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
              <div className="flex items-center justify-between pt-2 text-sm">
                <span className="text-foreground/60">Team fundraising total</span>
                <span className="font-heading font-extrabold text-xl text-primary">
                  ${team.team_fundraising_total.toLocaleString()}
                </span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to={`/team/${team.team_slug}`} target="_blank">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Preview your team page
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Team photo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Camera className="h-5 w-5" />
                Team photo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground/70">
                Shown on your team page, in our leaderboard during the tournament, and in our post-event recap.
              </p>
              <label
                htmlFor="team-photo"
                className="flex flex-col items-center justify-center border-2 border-dashed border-[#1A1A1A]/20 rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="max-h-56 rounded" />
                ) : team.team_photo_url ? (
                  <img src={team.team_photo_url} alt="Current team photo" className="max-h-56 rounded" />
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-[#1A1A1A]/50 mb-2" />
                    <span className="text-sm text-[#1A1A1A]/60">Tap to upload</span>
                    <span className="text-xs text-[#1A1A1A]/40 mt-1">PNG / JPG / HEIC, max 10 MB</span>
                  </>
                )}
              </label>
              {team.team_photo_url && !photoPreview && (
                <p className="text-xs text-center text-foreground/50">Current photo — tap to replace</p>
              )}
              <input
                id="team-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPhotoSelect}
              />
            </CardContent>
          </Card>

          {/* Team members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5" />
                Your teammates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/70">
                Add up to {MAX_TEAMMATES} golfers playing with you. Email is optional (helps us keep them looped in).
                Dietary restrictions help us plan the dinner.
              </p>

              {members.map((m, idx) => (
                <div key={idx} className="space-y-2 bg-muted/20 rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold text-sm text-foreground">Golfer {idx + 2}</p>
                    <Button size="sm" variant="ghost" onClick={() => removeMember(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`name-${idx}`} className="text-xs">Name *</Label>
                      <Input
                        id={`name-${idx}`}
                        value={m.name}
                        onChange={(e) => updateMember(idx, { name: e.target.value })}
                        placeholder="Alex Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`email-${idx}`} className="text-xs">Email</Label>
                      <Input
                        id={`email-${idx}`}
                        type="email"
                        value={m.email || ""}
                        onChange={(e) => updateMember(idx, { email: e.target.value })}
                        placeholder="alex@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`diet-${idx}`} className="text-xs">Dietary</Label>
                      <Input
                        id={`diet-${idx}`}
                        value={m.dietary || ""}
                        onChange={(e) => updateMember(idx, { dietary: e.target.value })}
                        placeholder="e.g., Vegetarian, GF"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`shirt-${idx}`} className="text-xs">Shirt size</Label>
                      <Input
                        id={`shirt-${idx}`}
                        value={m.shirt_size || ""}
                        onChange={(e) => updateMember(idx, { shirt_size: e.target.value })}
                        placeholder="M / L / XL"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {members.length < MAX_TEAMMATES && (
                <Button variant="outline" size="sm" onClick={addMember} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add a teammate
                </Button>
              )}
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saving} className="w-full" size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving…" : "Save team details"}
          </Button>

          {token && <UGCUploadSection token={token} />}
        </div>
      </section>
    </div>
  );
}

type PendingUpload = { file: File; preview: string; caption: string };

function UGCUploadSection({ token }: { token: string }) {
  const [queue, setQueue] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const oversize = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversize.length) {
      toast({
        title: "Some files too large",
        description: `${oversize.length} photo(s) exceed 10 MB and were skipped.`,
        variant: "destructive",
      });
    }
    const accepted = files.filter((f) => f.size <= 10 * 1024 * 1024);
    setQueue((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, preview: URL.createObjectURL(file), caption: "" })),
    ]);
    e.target.value = ""; // allow re-selecting same file
  };

  const removeAt = (i: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const removed = next.splice(i, 1)[0];
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const updateCaption = (i: number, caption: string) => {
    setQueue((prev) => prev.map((item, idx) => (idx === i ? { ...item, caption } : item)));
  };

  const submitAll = async () => {
    if (!queue.length) return;
    setUploading(true);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    let ok = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        const uploadRes = await fetch(
          `${supabaseUrl}/functions/v1/ugc-upload?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(item.file.name)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": item.file.type,
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: item.file,
          }
        );
        if (!uploadRes.ok) throw new Error((await uploadRes.json().catch(() => ({}))).error || "upload failed");
        const { url } = await uploadRes.json();

        const submitRes = await fetch(`${supabaseUrl}/functions/v1/ugc-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ token, photo_url: url, caption: item.caption || undefined }),
        });
        if (!submitRes.ok) throw new Error((await submitRes.json().catch(() => ({}))).error || "submit failed");
        ok++;
      } catch (err) {
        console.warn("[UGC] upload failed:", err);
        failed++;
      }
    }
    // Clean up object URLs
    for (const item of queue) URL.revokeObjectURL(item.preview);
    setQueue([]);
    setUploadedCount((prev) => prev + ok);
    setUploading(false);
    toast({
      title: `${ok} photo${ok === 1 ? "" : "s"} submitted`,
      description: failed > 0
        ? `${failed} failed — try again or use smaller files.`
        : "They'll appear after admin review.",
      variant: failed > 0 ? "destructive" : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-5 w-5" />
          Upload event photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/70">
          Snap photos throughout the day and send them our way — shots of your team, the course,
          auction items, or anything memorable. Admin reviews before anything is posted publicly.
        </p>

        <label
          htmlFor="ugc-files"
          className="flex flex-col items-center justify-center border-2 border-dashed border-[#1A1A1A]/20 rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
        >
          <Upload className="h-8 w-8 text-[#1A1A1A]/50 mb-2" />
          <span className="text-sm text-[#1A1A1A]/60">Tap to add photos</span>
          <span className="text-xs text-[#1A1A1A]/40 mt-1">PNG / JPG / HEIC, max 10 MB each</span>
        </label>
        <input
          id="ugc-files"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onSelect}
        />

        {queue.length > 0 && (
          <div className="space-y-3">
            {queue.map((item, idx) => (
              <div key={idx} className="flex gap-3 bg-muted/20 rounded p-3">
                <img src={item.preview} alt="" className="h-20 w-20 rounded object-cover shrink-0" />
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={item.caption}
                    onChange={(e) => updateCaption(idx, e.target.value)}
                    placeholder="Caption (optional)"
                    rows={2}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeAt(idx)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button onClick={submitAll} disabled={uploading} className="w-full" size="lg">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading…" : `Submit ${queue.length} photo${queue.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}

        {uploadedCount > 0 && (
          <p className="text-xs text-center text-foreground/50">
            {uploadedCount} photo{uploadedCount === 1 ? "" : "s"} submitted this session — thank you!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
