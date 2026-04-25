import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart } from "lucide-react";

interface RecentDonor {
  display_name: string;
  amount: number;
  created_at: string;
}

const REFRESH_INTERVAL_MS = 60_000;
const FETCH_LIMIT = 8;

const formatRelative = (iso: string): string | null => {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return null;
  const diffMs = Date.now() - created;
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 1) return "just now";
  if (hours < 24) return "today";
  return null;
};

const DonationTicker = () => {
  const [donors, setDonors] = useState<RecentDonor[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await anonSupabase.rpc("get_public_recent_donors", {
        _limit: FETCH_LIMIT,
      });
      if (cancelled) return;
      if (error) {
        setDonors([]);
      } else {
        setDonors((data as RecentDonor[]) ?? []);
      }
      setLoading(false);
    };

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="section-light border-y border-[#1A1A1A]/10">
      <div className="container py-8 md:py-10">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-4 w-4 text-primary" />
          <p className="font-heading font-bold text-xs tracking-[0.25em] uppercase text-[#1A1A1A]/60">
            Recent Supporters
          </p>
        </div>

        {loading && (
          <div className="flex flex-wrap gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-44 rounded-full" />
            ))}
          </div>
        )}

        {!loading && donors && donors.length === 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[#1A1A1A]/60 text-sm">
              Be the first to support Hope 4 Holden.
            </p>
            <Button
              asChild
              size="sm"
              className="rounded bg-primary text-white hover:bg-[#4A7C09] font-heading font-bold uppercase tracking-wider self-start"
            >
              <Link to="/register#donate">Donate Now</Link>
            </Button>
          </div>
        )}

        {!loading && donors && donors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {donors.map((d, i) => {
              const relative = formatRelative(d.created_at);
              return (
                <div
                  key={`${d.created_at}-${i}`}
                  className="inline-flex items-center gap-2 bg-white border border-[#1A1A1A]/10 rounded-full px-4 py-2 text-sm"
                >
                  <span className="text-[#1A1A1A] font-medium">{d.display_name}</span>
                  <span className="text-primary font-heading font-bold">
                    ${Number(d.amount).toLocaleString()}
                  </span>
                  {relative && (
                    <span className="text-[#1A1A1A]/40 text-xs">({relative})</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default DonationTicker;
