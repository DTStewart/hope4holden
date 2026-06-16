import { adminSupabase } from "@/integrations/supabase/adminClient";

/**
 * Ensures there is a valid Supabase session before running an authenticated query.
 * If the session is missing or expired and cannot be refreshed, redirects to /admin/login.
 *
 * Call at the top of every admin queryFn to prevent stale-token rendering of
 * empty/blank rows when RLS silently strips fields after token expiry.
 */
export async function ensureAdminSession(): Promise<void> {
  const { data, error } = await adminSupabase.auth.getSession();

  let session = data?.session ?? null;

  // If the access token is expired (or about to expire in <30s), force a refresh.
  const now = Math.floor(Date.now() / 1000);
  // TEMPORARY diagnostics: observe token lifetime and refresh outcomes on event day.
  const secondsRemaining = session?.expires_at != null ? session.expires_at - now : null;
  console.log("[ensure-session] getSession", {
    expires_at: session?.expires_at ?? null,
    secondsRemaining,
    hasSession: !!session,
    getSessionError: error?.message ?? null,
  });

  if (session && session.expires_at && session.expires_at - now < 30) {
    console.log("[ensure-session] refresh triggered (token expired or <30s remaining)", { secondsRemaining });
    const { data: refreshed, error: refreshError } = await adminSupabase.auth.refreshSession();
    if (refreshError) {
      console.warn("[ensure-session] refresh FAILED", { message: refreshError.message });
      redirectToLogin();
      throw new Error("Session expired");
    }
    const newExpiresAt = refreshed.session?.expires_at ?? null;
    console.log("[ensure-session] refresh SUCCEEDED", {
      newExpiresAt,
      newSecondsRemaining: newExpiresAt != null ? newExpiresAt - Math.floor(Date.now() / 1000) : null,
    });
    session = refreshed.session;
  } else {
    console.log("[ensure-session] refresh not triggered (token healthy)", { secondsRemaining });
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
