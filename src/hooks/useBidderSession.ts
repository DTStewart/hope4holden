import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { bidderSupabase } from "@/integrations/supabase/bidderClient";

export type BidderProfile = {
  id: string;
  email: string;
  phone: string;
  display_name: string;
  has_payment_method: boolean;
  attending_event: boolean;
  notify_outbid_sms: boolean;
};

export type BidderSessionState = {
  session: Session | null;
  profile: BidderProfile | null;
  loading: boolean;
  needsSetup: boolean;
};

/**
 * Tracks the currently signed-in bidder's Supabase Auth session AND their
 * auction_bidders profile. Returns { session, profile, loading, needsSetup }.
 *
 * needsSetup === true means they've signed in but haven't provided phone /
 * display name / card yet (first-time flow).
 */
export function useBidderSession() {
  const [state, setState] = useState<BidderSessionState>({
    session: null,
    profile: null,
    loading: true,
    needsSetup: false,
  });

  const fetchProfile = useCallback(async (session: Session | null): Promise<BidderProfile | null> => {
    if (!session) return null;
    try {
      const { data, error } = await bidderSupabase.rpc("get_my_bidder_profile");
      if (error) throw error;
      const first = Array.isArray(data) ? data[0] : data;
      return (first as BidderProfile) || null;
    } catch (err) {
      console.warn("[useBidderSession] profile lookup failed:", err);
      return null;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data: { session } } = await bidderSupabase.auth.getSession();
    const profile = await fetchProfile(session);
    setState({
      session,
      profile,
      loading: false,
      needsSetup: !!session && !profile,
    });
  }, [fetchProfile]);

  useEffect(() => {
    refresh();
    const { data: listener } = bidderSupabase.auth.onAuthStateChange((_event, session) => {
      // Defer client work out of this callback. GoTrue dispatches auth events
      // while holding the Navigator Lock (lock:h4h-bidder-auth); fetchProfile
      // calls rpc -> getSession on the same client, which re-enters that lock
      // and deadlocks it if run synchronously here, orphaning the lock so every
      // later getSession() stalls. setTimeout lets the lock release first.
      setTimeout(async () => {
        try {
          const profile = await fetchProfile(session);
          setState({
            session,
            profile,
            loading: false,
            needsSetup: !!session && !profile,
          });
        } catch (err) {
          // fetchProfile already swallows its own errors, but guard here too so
          // loading:true is never reachable if anything throws. Sane fallback:
          // keep the session, drop the profile, stop loading.
          console.warn("[useBidderSession] session change handling failed:", err);
          setState({
            session,
            profile: null,
            loading: false,
            needsSetup: false,
          });
        }
      }, 0);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [refresh, fetchProfile]);

  return { ...state, refresh };
}
