import { useCallback, useEffect, useState } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";

const STORAGE_KEY = "h4h_bidder_session";

export type BidderSession = {
  id: string;
  email: string;
  phone: string;
  display_name: string;
  has_payment_method: boolean;
  attending_event: boolean;
};

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearStoredSessionToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function useBidderSession() {
  const [bidder, setBidder] = useState<BidderSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getStoredSessionToken();
    if (!token) {
      setBidder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await anonSupabase.rpc("get_bidder_by_session", {
        _session_token: token,
      });
      if (error) throw error;
      const first = Array.isArray(data) ? data[0] : data;
      if (!first) {
        clearStoredSessionToken();
        setBidder(null);
      } else {
        setBidder(first as BidderSession);
      }
    } catch (err) {
      console.warn("[useBidderSession] lookup failed:", err);
      setBidder(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bidder, loading, refresh };
}
