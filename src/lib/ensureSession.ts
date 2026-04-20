import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures there is a valid Supabase session before running an authenticated query.
 * If the session is missing or expired and cannot be refreshed, redirects to /admin/login.
 *
 * Call at the top of every admin queryFn to prevent stale-token rendering of
 * empty/blank rows when RLS silently strips fields after token expiry.
 */
export async function ensureAdminSession(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();

  let session = data?.session ?? null;

  // If the access token is expired (or about to expire in <30s), force a refresh.
  const now = Math.floor(Date.now() / 1000);
  if (session && session.expires_at && session.expires_at - now < 30) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      redirectToLogin();
      throw new Error("Session expired");
    }
    session = refreshed.session;
  }

  if (error || !session) {
    redirectToLogin();
    throw new Error("Not authenticated");
  }
}

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
    window.location.href = "/admin/login";
  }
}
