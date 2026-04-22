import { useEffect, useState } from "react";
import type { SponsorMaterialsSponsor } from "@/components/SponsorMaterialsSection";

/**
 * Polls the sponsor-upload edge function (GET ?order_id=…) until the
 * stripe-webhook has created the sponsor row(s) for this pending_order_id.
 * Returns sponsors found, plus loading state.
 */
export function useSponsorsByOrderId(orderId: string | null) {
  const [sponsors, setSponsors] = useState<SponsorMaterialsSponsor[]>([]);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setTimedOut(false);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/sponsor-upload?order_id=${encodeURIComponent(orderId)}`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        if (!res.ok) {
          console.warn("[useSponsorsByOrderId] lookup returned non-ok:", res.status);
          return [];
        }
        const data = await res.json();
        return (data.sponsors || []) as SponsorMaterialsSponsor[];
      } catch (err) {
        console.warn("[useSponsorsByOrderId] lookup threw:", err);
        return [];
      }
    };

    // Final fallback: ask the server to email the upload link(s). Returns any
    // sponsors it finds so we can still render the inline form if they showed
    // up late.
    const triggerFallbackEmail = async (): Promise<SponsorMaterialsSponsor[]> => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/sponsor-upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ action: "send_fallback_email", order_id: orderId }),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.sponsors || []) as SponsorMaterialsSponsor[];
      } catch (err) {
        console.warn("[useSponsorsByOrderId] fallback email threw:", err);
        return [];
      }
    };

    const poll = async () => {
      // Try up to ~15s (8 attempts × ~2s) for the webhook to land.
      for (let i = 0; i < 8; i++) {
        if (cancelled) return;
        const found = await fetchOnce();
        if (found.length > 0) {
          if (!cancelled) {
            setSponsors(found);
            setLoading(false);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (cancelled) return;

      // Polling didn't find anything. Hit the fallback endpoint — it will
      // email the upload link(s) if sponsors exist, or no-op if not.
      const fallbackFound = await triggerFallbackEmail();
      if (cancelled) return;
      if (fallbackFound.length > 0) {
        setSponsors(fallbackFound);
      } else {
        setTimedOut(true);
      }
      setLoading(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return { sponsors, loading, timedOut };
}
