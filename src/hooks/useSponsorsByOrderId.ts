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

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/sponsor-upload?order_id=${encodeURIComponent(orderId)}`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.sponsors || []) as SponsorMaterialsSponsor[];
      } catch {
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
      if (!cancelled) setLoading(false);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return { sponsors, loading };
}
