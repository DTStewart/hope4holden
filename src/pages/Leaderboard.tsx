import { useEffect, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Trophy, Medal } from "lucide-react";

type Entry = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  final_score: number;
  photo_url: string;
  submitted_at: string;
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const { data, error } = await anonSupabase.rpc("get_leaderboard");
        if (error) throw error;
        if (!cancelled) setEntries((data as Entry[]) || []);
      } catch (err) {
        console.warn("[Leaderboard] fetch failed:", err);
        if (!cancelled && entries === null) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 15_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-12 md:py-16 animate-fade-in relative z-10 text-center">
          <Trophy className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="section-label">Tournament</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95]">
            Leaderboard
          </h1>
          <p className="text-white/60 mt-3 text-sm">Verified scores, lowest wins.</p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-10 md:py-14 max-w-3xl">
          {loading && !entries ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            </div>
          ) : !entries?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-foreground/60">
                Scores are rolling in. Refresh or check back shortly.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.map((e, idx) => {
                const rank = idx + 1;
                const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                return (
                  <Card
                    key={e.registration_id}
                    className={rank === 1 ? "border-primary/40 bg-primary/5" : ""}
                  >
                    <CardContent className="py-4 flex items-center gap-4">
                      <div className="w-10 text-center font-heading font-extrabold text-xl text-foreground/70">
                        {medal || rank}
                      </div>
                      {e.photo_url ? (
                        <button
                          type="button"
                          onClick={() => setOpenPhoto(e.photo_url)}
                          className="h-12 w-12 rounded bg-muted overflow-hidden shrink-0 hover:ring-2 hover:ring-primary transition-all"
                          aria-label="View scorecard photo"
                        >
                          <img src={e.photo_url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-heading font-bold text-foreground truncate">{e.team_name}</div>
                        {e.business_name && e.business_name !== e.team_name && (
                          <div className="text-xs text-foreground/50 truncate">{e.business_name}</div>
                        )}
                      </div>
                      <div className="font-heading font-extrabold text-2xl text-primary">
                        {e.final_score}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {openPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpenPhoto(null)}
          role="dialog"
        >
          <img src={openPhoto} alt="Scorecard" className="max-h-[90vh] max-w-full rounded shadow-2xl" />
          <button
            type="button"
            onClick={() => setOpenPhoto(null)}
            className="absolute top-4 right-4 bg-white/10 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
