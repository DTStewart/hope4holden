import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Loader2, Camera, Trophy } from "lucide-react";

type Team = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  already_submitted: boolean;
};

export default function Scorecard() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "invalid" | "already" | "ready" | "submitted" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [team, setTeam] = useState<Team | null>(null);
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    try {
      const { data, error } = await anonSupabase.rpc("lookup_team_by_score_token", {
        _token: token,
      });
      if (error) throw error;
      const first = Array.isArray(data) ? data[0] : data;
      if (!first) {
        setStatus("invalid");
        return;
      }
      setTeam(first as Team);
      setStatus((first as Team).already_submitted ? "already" : "ready");
    } catch (err: any) {
      console.error("[Scorecard] load failed:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Could not load this link. Try again?");
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !team) return;
    const numeric = Number(score);
    if (!numeric || numeric <= 0 || numeric >= 300) {
      toast({ title: "Score looks off", description: "Enter your team's total score.", variant: "destructive" });
      return;
    }
    if (!photo) {
      toast({ title: "Add a scorecard photo", description: "We need the photo to verify final scores.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Upload the photo to storage via the edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const uploadRes = await fetch(
        `${supabaseUrl}/functions/v1/scorecard-upload?token=${encodeURIComponent(token)}&filename=${encodeURIComponent(photo.name)}`,
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
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || "Photo upload failed.");
      }
      const { url: photoUrl } = await uploadRes.json();

      // 2. Submit score via RPC
      const { data, error } = await anonSupabase.rpc("submit_scorecard", {
        _token: token,
        _final_score: numeric,
        _photo_url: photoUrl,
        _submitter_note: note.trim() || null,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) {
        if (result?.error === "already_submitted") {
          setStatus("already");
          return;
        }
        throw new Error(result?.error || "Submission rejected");
      }
      setStatus("submitted");
    } catch (err: any) {
      toast({ title: "Couldn't submit", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
          <p className="text-foreground/60">
            This scorecard link isn't valid. If you think it should be, email{" "}
            <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>.
          </p>
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

  if (status === "already") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <CheckCircle className="h-14 w-14 text-primary mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Already submitted</h1>
          <p className="text-foreground/60">
            {team?.team_name} already has a scorecard on file. Contact us at{" "}
            <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>{" "}
            if you need to correct it.
          </p>
          <Button asChild variant="outline">
            <Link to="/leaderboard">
              <Trophy className="h-4 w-4 mr-2" /> View leaderboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <CheckCircle className="h-14 w-14 text-primary mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Scorecard submitted</h1>
          <p className="text-foreground/60">
            Thanks! Your score is pending verification by the organizers. Once verified, it'll appear
            on the tournament leaderboard.
          </p>
          <Button asChild>
            <Link to="/leaderboard">
              <Trophy className="h-4 w-4 mr-2" /> View leaderboard
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-12 md:py-16 animate-fade-in relative z-10 text-center">
          <Trophy className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="section-label">Submit your score</p>
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight mt-1">
            {team?.team_name || "Your team"}
          </h1>
          {team?.business_name && team.business_name !== team.team_name && (
            <p className="text-white/60 mt-2 text-sm">{team.business_name}</p>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-10 md:py-14 max-w-md">
          <Card>
            <CardContent className="py-6">
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="score">Final score</Label>
                  <Input
                    id="score"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={299}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    placeholder="72"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Your team's total score for the round.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Scorecard photo</Label>
                  <label
                    htmlFor="photo"
                    className="flex flex-col items-center justify-center border-2 border-dashed border-[#1A1A1A]/20 rounded-lg p-6 cursor-pointer hover:border-primary transition-colors"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Scorecard preview" className="max-h-48 rounded" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8 text-[#1A1A1A]/50 mb-2" />
                        <span className="text-sm text-[#1A1A1A]/60 text-center">Tap to take or upload a photo</span>
                        <span className="text-xs text-[#1A1A1A]/40 mt-1">PNG / JPG / HEIC, max 10 MB</span>
                      </>
                    )}
                  </label>
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={onPhotoSelect}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">Notes (optional)</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Anything we should know — mulligans, skins, etc."
                  />
                </div>

                <Button type="submit" disabled={submitting} className="w-full" size="lg">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
                  {submitting ? "Submitting…" : "Submit scorecard"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
