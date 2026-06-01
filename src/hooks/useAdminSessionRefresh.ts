import { useEffect } from "react";
import { adminSupabase } from "@/integrations/supabase/adminClient";

/**
 * Refreshes the admin Supabase session whenever the tab regains focus.
 *
 * When a laptop sleeps or a tab sits backgrounded for a while, the access
 * token can lapse while autoRefreshToken is paused. On the next
 * visibilitychange back to visible we proactively read the session and, if the
 * access token is already expired or within 60s of expiry, refresh it before
 * returning. That way the first admin query after refocus runs with a live
 * token instead of returning blank rows under RLS.
 *
 * Wire this into admin screens so it runs whenever an admin tab is focused.
 */
export function useAdminSessionRefresh(): void {
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      const { data } = await adminSupabase.auth.getSession();
      const session = data?.session ?? null;
      if (!session) return;

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at ?? 0;
      // Expired, or inside the 60s pre-expiry window: refresh before returning.
      if (expiresAt - now <= 60) {
        await adminSupabase.auth.refreshSession();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);
}
