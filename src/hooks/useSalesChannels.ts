import { useEffect, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";

export type SalesChannelName =
  | "registration"
  | "dinner"
  | "donation"
  | "sponsorship"
  | "auction";

export interface SalesChannel {
  channel: SalesChannelName;
  enabled: boolean;
  disabled_message: string | null;
}

export type SalesChannelMap = Record<SalesChannelName, SalesChannel>;

const DEFAULTS: SalesChannelMap = {
  registration: { channel: "registration", enabled: true, disabled_message: null },
  dinner: { channel: "dinner", enabled: true, disabled_message: null },
  donation: { channel: "donation", enabled: true, disabled_message: null },
  sponsorship: { channel: "sponsorship", enabled: true, disabled_message: null },
  auction: { channel: "auction", enabled: true, disabled_message: null },
};

/**
 * Loads per-channel kill switches from public.sales_channels.
 * Fails open (all enabled) on error so a transient query failure can't
 * black out the public sales surfaces.
 */
export function useSalesChannels() {
  const [channels, setChannels] = useState<SalesChannelMap>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await anonSupabase
        .from("sales_channels")
        .select("channel, enabled, disabled_message");
      if (cancelled) return;
      if (!error && data) {
        const next = { ...DEFAULTS };
        for (const row of data) {
          const c = row.channel as SalesChannelName;
          if (c in next) {
            next[c] = {
              channel: c,
              enabled: !!row.enabled,
              disabled_message: row.disabled_message ?? null,
            };
          }
        }
        setChannels(next);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { channels, loading };
}
