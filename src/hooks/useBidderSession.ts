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
    const { data: listener } = bidderSupabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = await fetchProfile(session);
      setState({
        session,
        profile,
        loading: false,
        needsSetup: !!session && !profile,
      });
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [refresh, fetchProfile]);

  return { ...state, refresh };
}
