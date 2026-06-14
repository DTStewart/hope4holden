import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, AlertCircle, Users, Camera, Save, Copy, Trophy, ExternalLink, X, Upload, ImageIcon, Star,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type GolferRow = {
  name: string;
  email: string;
  phone?: string;
  dietary?: string;
};

type Team = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  team_slug: string;
  team_members: any;
  team_photo_url: string | null;
  captain_name: string;
  captain_email: string;
  captain_phone: string | null;
  golfer_count: number | null;
  team_fundraising_total: number;
};

const DEFAULT_GOLFER_COUNT = 4;
const SHOW_TEAM_FUNDRAISING = false;

export default function TeamManage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "error">("loading");
  const [team, setTeam] = useState<Team | null>(null);
  const [rows, setRows] = useState<GolferRow[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const golferCount = useMemo(
    () => (team?.golfer_count && team.golfer_count > 0 ? team.golfer_count : DEFAULT_GOLFER_COUNT),
    [team]
  );

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

      const count = t.golfer_count && t.golfer_count > 0 ? t.golfer_count : DEFAULT_GOLFER_COUNT;
      const existing: GolferRow[] = Array.isArray(t.team_members) ? t.team_members : [];

      // Row 1 = captain (prefilled from captain_* columns, but prefer existing team_members[0]
      // if it already carries dietary info the captain entered previously).
      const captainRow: GolferRow = {
        name: existing[0]?.name?.trim() || t.captain_name || "",
        email: existing[0]?.email?.trim() || t.captain_email || "",
        phone: existing[0]?.phone?.trim() || t.captain_phone || "",
        dietary: existing[0]?.dietary || "",
      };

      // Rows 2..count = teammates (from saved team_members[1..] if present, else blank).
      const teammates: GolferRow[] = [];
      for (let i = 1; i < count; i++) {
        const e: Partial<GolferRow> = existing[i] || {};
        teammates.push({
          name: e.name || "",
          email: e.email || "",
          phone: e.phone || "",
          dietary: e.dietary || "",
        });
      }

      setRows([captainRow, ...teammates]);
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

  const updateRow = (idx: number, patch: Partial<GolferRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const validate = (): { ok: true } | { ok: false; msg: string } => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const label = i === 0 ? "Captain" : `Golfer ${i + 1}`;
      if (!r.name?.trim()) return { ok: false, msg: `${label}: name is required.` };
      if (!r.email?.trim()) return { ok: false, msg: `${label}: email is required.` };
    }
    return { ok: true };
  };

  const save = async () => {
    if (!token || !team) return;
    const v = validate();
    if (!v.ok) {
      toast({ title: "Missing info", description: (v as { ok: false; msg: string }).msg, variant: "destructive" });
      return;
    }
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

      const cleanRows = rows.map((r) => ({
        name: r.name.trim(),
        email: r.email.trim(),
        phone: r.phone?.trim() || undefined,
        dietary: r.dietary?.trim() || undefined,
      }));

      const captain = cleanRows[0];

      const { error } = await anonSupabase.rpc("update_team_details", {
        _token: token,
        _team_members: cleanRows,
        _team_photo_url: photoUrl,
        _captain_name: captain.name,
        _captain_email: captain.email,
        _captain_phone: captain.phone ?? null,
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
    <div className="pb-24 md:pb-0">
      <section className="section-dark relative overflow-hidden">
        <div className="container py-12 md:py-16 animate-fade-in relative z-10">
          <p className="section-label">Manage your team</p>
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight mt-1">
            {team.team_name}
          </h1>
          <p className="text-white/60 mt-2 text-sm">
            {golferCount} golfers on this team
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-10 md:py-14 max-w-2xl space-y-6">

          {SHOW_TEAM_FUNDRAISING && (
            <>
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
            </>
          )}

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
                className="hidden"
                onChange={onPhotoSelect}
              />
            </CardContent>
          </Card>

          {/* Roster */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trophy className="h-5 w-5" />
                Your roster ({golferCount} golfers)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/70">
                Name and email are required for every golfer. Phone and dietary restrictions are optional —
                dietary info helps us plan dinner.
              </p>

              {rows.map((r, idx) => {
                const isCaptain = idx === 0;
                return (
                  <div
                    key={idx}
                    className={`space-y-3 rounded-lg p-4 border ${
                      isCaptain
                        ? "bg-primary/5 border-primary/30"
                        : "bg-muted/20 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCaptain ? (
                        <>
                          <Star className="h-4 w-4 text-primary fill-primary" />
                          <p className="font-heading font-bold text-sm text-foreground">
                            Captain / team contact
                          </p>
                        </>
                      ) : (
                        <p className="font-heading font-bold text-sm text-foreground">
                          Golfer {idx + 1}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`name-${idx}`} className="text-xs">
                          Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`name-${idx}`}
                          value={r.name}
                          onChange={(e) => updateRow(idx, { name: e.target.value })}
                          placeholder="Full name"
                          autoComplete="name"
                          inputMode="text"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`email-${idx}`} className="text-xs">
                          Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`email-${idx}`}
                          type="email"
                          value={r.email}
                          onChange={(e) => updateRow(idx, { email: e.target.value })}
                          placeholder="email@example.com"
                          autoComplete="email"
                          inputMode="email"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`phone-${idx}`} className="text-xs">Phone</Label>
                        <Input
                          id={`phone-${idx}`}
                          type="tel"
                          value={r.phone || ""}
                          onChange={(e) => updateRow(idx, { phone: e.target.value })}
                          placeholder="(555) 123-4567"
                          autoComplete="tel"
                          inputMode="tel"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`diet-${idx}`} className="text-xs">Dietary</Label>
                        <Input
                          id={`diet-${idx}`}
                          value={r.dietary || ""}
                          onChange={(e) => updateRow(idx, { dietary: e.target.value })}
                          placeholder="e.g., Vegetarian, GF"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Inline save (desktop / end of form) */}
          <Button onClick={save} disabled={saving} className="w-full hidden md:flex" size="lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving…" : "Save team details"}
          </Button>

          {token && <UGCUploadSection token={token} />}
        </div>
      </section>

      {/* Sticky mobile save bar — always reachable on phones */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Button onClick={save} disabled={saving} className="w-full" size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving…" : "Save team details"}
        </Button>
      </div>
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
    e.target.value = "";
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
