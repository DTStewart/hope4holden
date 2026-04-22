import { useCallback, useEffect, useRef, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { DollarSign, Gavel, Trophy, Sparkles, Loader2 } from "lucide-react";

// Shape returned by get_live_dashboard_state. Kept loose (the RPC returns
// JSONB so the generated types can't express it precisely).
type Settings = {
  id: number;
  show_auction: boolean;
  show_leaderboard: boolean;
  show_rainbow: boolean;
  show_fundraising: boolean;
  refresh_interval_seconds: number;
};

type TopItem = {
  id: string;
  title: string;
  images: Array<{ url: string; alt?: string }> | null;
  starting_bid: number;
  status: "open" | "closed" | "draft";
  current_bid: number;
  bid_count: number;
};

type RainbowWinner = {
  id: string;
  prize_description: string;
  winner_name: string;
  amount: number | null;
  sort_order: number;
};

type LeaderboardEntry = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  team_photo_url: string | null;
  final_score: number;
};

type Fundraising = {
  total_raised: number;
  teams_count: number;
  sponsors_total: number;
  donations_total: number;
  dinners_total: number;
};

type DashboardState = {
  settings: Settings;
  top_items: TopItem[];
  rainbow_winners: RainbowWinner[];
  leaderboard: LeaderboardEntry[];
  fundraising: Fundraising;
  generated_at: string;
};

export default function LiveDashboard() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshMs = state?.settings?.refresh_interval_seconds
    ? state.settings.refresh_interval_seconds * 1000
    : 30_000;

  const fetchState = useCallback(async () => {
    try {
      const { data, error } = await anonSupabase.rpc("get_live_dashboard_state");
      if (error) throw error;
      setState(data as unknown as DashboardState);
      setError(null);
    } catch (err) {
      console.warn("[LiveDashboard] fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  // Initial + polling refresh (covers rainbow winners, settings, fundraising).
  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, refreshMs);
    return () => clearInterval(id);
  }, [fetchState, refreshMs]);

  // Realtime: refetch on bid, scorecard, or rainbow-winner changes.
  // One big re-fetch keeps the page source-of-truth consistent with the RPC.
  const fetchRef = useRef(fetchState);
  useEffect(() => { fetchRef.current = fetchState; }, [fetchState]);

  useEffect(() => {
    const debounced = (() => {
      let t: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (t) clearTimeout(t);
        t = setTimeout(() => fetchRef.current(), 500);
      };
    })();

    const channel = anonSupabase
      .channel("live-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_bids" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "auction_items" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "scorecard_submissions" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "rainbow_auction_winners" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_dashboard_settings" }, debounced)
      .subscribe();

    return () => { anonSupabase.removeChannel(channel); };
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center">
        {error ? (
          <div className="text-center">
            <p className="text-xl text-white/60">{error}</p>
            <p className="text-sm text-white/30 mt-2">Retrying…</p>
          </div>
        ) : (
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        )}
      </div>
    );
  }

  const { settings, top_items, rainbow_winners, leaderboard, fundraising } = state;
  const anyVisible =
    settings.show_fundraising ||
    settings.show_auction ||
    settings.show_leaderboard ||
    settings.show_rainbow;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-8 md:p-12">
      <div className="max-w-[1800px] mx-auto space-y-10">
        <header className="flex items-baseline justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary font-semibold">Hope 4 Holden · Live</p>
            <h1 className="font-heading font-extrabold text-4xl md:text-6xl">Tonight we ride for Holden</h1>
          </div>
          <p className="hidden md:block text-xs text-white/30">
            Updated {new Date(state.generated_at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
          </p>
        </header>

        {!anyVisible && (
          <div className="text-center py-32 text-white/50">
            <p className="text-2xl">Projector standby</p>
            <p className="text-sm mt-2">All sections hidden — enable one in admin.</p>
          </div>
        )}

        {settings.show_fundraising && <FundraisingStrip f={fundraising} />}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          {settings.show_auction && <TopItemsSection items={top_items} />}
          {settings.show_leaderboard && <LeaderboardSection entries={leaderboard} />}
        </div>

        {settings.show_rainbow && <RainbowSection winners={rainbow_winners} />}
      </div>
    </div>
  );
}

function FundraisingStrip({ f }: { f: Fundraising }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="h-6 w-6 text-primary" />
        <h2 className="section-label text-white/70">Total raised</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        <div className="md:col-span-2">
          <p className="font-heading font-extrabold text-7xl md:text-8xl text-primary leading-none">
            ${f.total_raised.toLocaleString("en-CA")}
          </p>
          <p className="text-sm text-white/40 mt-2">Every dollar → A-T research via ATCP</p>
        </div>
        <Stat label="Teams" value={f.teams_count} />
        <Stat label="Sponsors" value={`$${f.sponsors_total.toLocaleString("en-CA")}`} />
        <Stat label="Donations" value={`$${f.donations_total.toLocaleString("en-CA")}`} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wider text-white/50">{label}</p>
      <p className="font-heading font-extrabold text-3xl md:text-4xl mt-1">{value}</p>
    </div>
  );
}

function TopItemsSection({ items }: { items: TopItem[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <Gavel className="h-6 w-6 text-primary" />
        <h2 className="section-label text-white/70">Top auction bids</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-white/40 italic">Items coming soon.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => {
            const img = item.images?.[0]?.url;
            return (
              <li
                key={item.id}
                className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-lg p-4"
              >
                <span className="w-8 text-center font-heading font-extrabold text-2xl text-white/40">
                  {i + 1}
                </span>
                {img ? (
                  <img src={img} alt="" className="h-16 w-16 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded bg-white/10 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-lg truncate">{item.title}</p>
                  <p className="text-xs text-white/40">
                    {item.bid_count} bid{item.bid_count === 1 ? "" : "s"}
                    {item.status === "closed" ? " · closed" : ""}
                  </p>
                </div>
                <p className="font-heading font-extrabold text-3xl md:text-4xl text-primary tabular-nums">
                  ${item.current_bid.toLocaleString("en-CA")}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <Trophy className="h-6 w-6 text-primary" />
        <h2 className="section-label text-white/70">Leaderboard · lowest wins</h2>
      </div>
      {entries.length === 0 ? (
        <p className="text-white/40 italic">Scores rolling in Friday.</p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e, i) => {
            const rank = i + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            return (
              <li
                key={e.registration_id}
                className={`flex items-center gap-4 rounded-lg p-3 ${
                  rank === 1 ? "bg-primary/10 border border-primary/30" : "bg-white/5 border border-white/10"
                }`}
              >
                <span className="w-10 text-center font-heading font-extrabold text-2xl">
                  {medal || rank}
                </span>
                {e.team_photo_url ? (
                  <img src={e.team_photo_url} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded bg-white/10 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-base truncate">{e.team_name}</p>
                  {e.business_name && e.business_name !== e.team_name && (
                    <p className="text-xs text-white/40 truncate">{e.business_name}</p>
                  )}
                </div>
                <p className="font-heading font-extrabold text-3xl text-primary tabular-nums">
                  {e.final_score}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function RainbowSection({ winners }: { winners: RainbowWinner[] }) {
  if (winners.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <Sparkles className="h-6 w-6 text-primary" />
        <h2 className="section-label text-white/70">Rainbow auction winners</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {winners.map((w) => (
          <div key={w.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
            <p className="font-heading font-bold text-lg">{w.prize_description}</p>
            <p className="text-primary text-base mt-1">→ {w.winner_name}</p>
            {w.amount != null && (
              <p className="text-xs text-white/40 mt-1">${w.amount.toLocaleString("en-CA")}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
