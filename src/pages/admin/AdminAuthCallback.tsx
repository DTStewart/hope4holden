import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/**
 * Dedicated landing for the admin Google OAuth return.
 *
 * Google redirects here (/admin/auth/callback) with the tokens in the URL
 * fragment (#access_token=...). This route exists on purpose so the OAuth return
 * does NOT land on:
 *   - /admin/login, which PasswordRecoveryRedirect treats as a recovery path when
 *     the hash carries an access_token (it would bounce to /reset-password), or
 *   - /admin, which is behind ProtectedRoute and would redirect to login before
 *     the session is finalized.
 *
 * It is a PUBLIC route (outside ProtectedRoute): finalize the session first, then
 * redirect. Its only job is finalize-then-redirect; it never loops back to itself.
 */
export default function AdminAuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const ranRef = useRef(false);
  const [status, setStatus] = useState<"working" | "redirecting">("working");

  useEffect(() => {
    // Finalize exactly once (React StrictMode double-invokes effects in dev).
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    const fail = (description: string) => {
      if (cancelled) return;
      setStatus("redirecting");
      toast({ title: "Google sign-in failed", description, variant: "destructive" });
      // Always land on the login form on failure — never re-enter the callback.
      navigate("/admin/login", { replace: true });
    };

    (async () => {
      // The Lovable OAuth broker returns tokens in the URL fragment
      // (#access_token=...&refresh_token=...). The cloud-auth SDK never consumes
      // this return-trip fragment — it only ever STARTS a new OAuth attempt — so
      // we finalize the session here by parsing the fragment ourselves and
      // handing the tokens straight to the admin Supabase client.
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(rawHash);

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const oauthError = params.get("error");
      const oauthErrorDescription = params.get("error_description");

      console.log("[auth-callback] mount", {
        hash: window.location.hash,
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
        oauthError,
      });

      // Broker returned an OAuth error in the fragment instead of tokens.
      if (oauthError) {
        const message = oauthErrorDescription || oauthError;
        console.error("[auth-callback] branch: oauth error in hash", {
          oauthError,
          oauthErrorDescription,
        });
        fail(message);
        return;
      }

      // No tokens in the fragment → nothing to finalize. Back to login, never loop.
      if (!accessToken || !refreshToken) {
        console.error("[auth-callback] branch: no tokens in hash", {
          hasAccessToken: Boolean(accessToken),
          hasRefreshToken: Boolean(refreshToken),
        });
        fail("No sign-in token was returned. Please try again.");
        return;
      }

      try {
        // Write the session to the h4h-admin-auth store that useAuth reads.
        console.log("[auth-callback] branch: setSession from hash tokens");
        const { error } = await adminSupabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          console.error("[auth-callback] setSession failed", error);
          fail(error.message);
          return;
        }
        // Session persisted. Navigate to /admin with replace so the #access_token
        // fragment is stripped THROUGH React Router (location stays in sync) and
        // the now-authenticated admin lands on the dashboard.
        console.log("[auth-callback] setSession success");
        setStatus("redirecting");
        navigate("/admin", { replace: true });
      } catch (e) {
        console.error("[auth-callback] setSession failed", e);
        fail(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {status === "working" ? "Signing you in..." : "Redirecting..."}
      </div>
    </div>
  );
}
