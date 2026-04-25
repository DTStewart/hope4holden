import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Heart } from "lucide-react";

interface RecentDonor {
  display_name: string;
  amount: number;
  created_at: string;
}

const REFRESH_INTERVAL_MS = 60_000;
const ROTATE_INTERVAL_MS = 4000;
const FETCH_LIMIT = 10;

const formatRelative = (iso: string): string => {
  const created = new Date(iso);
  const ms = Date.now() - created.getTime();
  if (Number.isNaN(ms)) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return created.toLocaleDateString("en-US", { month: "long", day: "numeric" });
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return reduced;
};

const Entry = ({ donor }: { donor: RecentDonor }) => (
  <div className="flex items-center justify-between gap-4 w-full min-w-0">
    <p className="text-base md:text-lg text-[#1A1A1A] truncate min-w-0">
      <span className="font-sans">{donor.display_name} donated </span>
      <span className="font-heading font-semibold text-primary">
        ${Number(donor.amount).toLocaleString()}
      </span>
    </p>
    <span className="text-sm text-foreground/50 whitespace-nowrap shrink-0">
      {formatRelative(donor.created_at)}
    </span>
  </div>
);

const DonationTicker = () => {
  const [donors, setDonors] = useState<RecentDonor[] | null>(null);
  const [supporterCount, setSupporterCount] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [donorsRes, countRes] = await Promise.all([
        anonSupabase.rpc("get_public_recent_donors", { _limit: FETCH_LIMIT }),
        anonSupabase.rpc("get_public_supporter_count"),
      ]);
      if (cancelled) return;
      if (donorsRes.error) {
        setDonors((prev) => prev ?? []);
      } else {
        const next = (donorsRes.data as RecentDonor[]) ?? [];
        setDonors((prev) => {
          if (prev && next.length > 0 && indexRef.current >= next.length) {
            setIndex(0);
          }
          return next;
        });
      }
      if (!countRes.error) {
        setSupporterCount(typeof countRes.data === "number" ? countRes.data : 0);
      }
    };
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const canRotate = !reducedMotion && donors && donors.length > 1 && !paused;

  useEffect(() => {
    if (!canRotate) return;
    const total = donors!.length;
    const id = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % total);
        setVisible(true);
      }, 300);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [canRotate, donors]);

  const containerClasses =
    "w-full bg-primary/5 border-y border-primary/10";
  const innerClasses =
    "container min-h-[60px] py-3 flex items-center gap-3";

  const showHeader = supporterCount !== null && supporterCount > 0;
  const headerLine = showHeader ? (
    <div className="container pt-4 pb-3">
      <p className="font-heading font-semibold text-xl md:text-2xl text-[#1A1A1A]">
        <span className="text-primary">{supporterCount.toLocaleString()}</span>{" "}
        supporter{supporterCount === 1 ? "" : "s"} this year
      </p>
    </div>
  ) : null;

  // Loading: render nothing visible to avoid layout shift / placeholder noise.
  if (donors === null) {
    return (
      <section className={containerClasses} aria-label="Recent donations to Hope 4 Holden">
        {headerLine}
        <div className={innerClasses}>
          <Heart className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span className="sr-only">Loading recent donations…</span>
        </div>
      </section>
    );
  }

  // Empty state — header hidden by zero count
  if (donors.length === 0) {
    return (
      <section className={containerClasses} aria-label="Recent donations to Hope 4 Holden">
        <Link
          to="/register#donate"
          className={`${innerClasses} hover:bg-primary/10 transition-colors`}
        >
          <Heart className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span className="text-base md:text-lg text-[#1A1A1A]">
            Be the first to support Hope 4 Holden
          </span>
        </Link>
      </section>
    );
  }

  // Reduced motion: static stack of up to 3 entries
  if (reducedMotion) {
    const items = donors.slice(0, 3);
    return (
      <section className={containerClasses} aria-label="Recent donations to Hope 4 Holden">
        {headerLine}
        <div className="container py-3 flex flex-col gap-2">
          {items.map((d, i) => (
            <div key={`${d.created_at}-${i}`} className="flex items-center gap-3">
              <Heart className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <Entry donor={d} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const current = donors[Math.min(index, donors.length - 1)];

  return (
    <section
      className={containerClasses}
      aria-label="Recent donations to Hope 4 Holden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {headerLine}
      <div className={innerClasses}>
        <Heart className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <div
          aria-live="polite"
          className={`flex-1 min-w-0 transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <Entry donor={current} />
        </div>
      </div>
    </section>
  );
};

export default DonationTicker;
