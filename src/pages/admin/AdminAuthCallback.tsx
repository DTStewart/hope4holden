import { useEffect, useState } from "react";
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

/**
 * One-shot guard that survives component remounts.
 *
 * A useRef resets on every fresh mount, so React StrictMode's
 * mount → unmount → remount (and any production double-mount of this route)
 * defeats it: each mount sees the ref as false and runs the finalize — and thus
 * setSession — again. Two concurrent setSession calls then race for the gotrue
 * lock "lock:h4h-admin-auth"; one gets stolen and rejects with an AbortError
 * ("Lock was released because another request stole it"), which previously hit
 * fail() and showed a false "Google sign-in failed" toast even though the
 * session was established.
 *
 * This flag lives OUTSIDE React, so it is set exactly once per page load. The
 * OAuth return always arrives via a full-page redirect from the broker, so the
 * module reloads (and this resets) for every genuine new callback — it will not
 * wrongly block a real subsequent sign-in.
 */
let finalizeStarted = false;

export default function AdminAuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"working" | "redirecting">("working");

  useEffect(() => {
    // Finalize exactly once across all (re)mounts of this route.
    if (finalizeStarted) return;
    finalizeStarted = true;

    const fail = (description: string) => {
      setStatus("redirecting");
      toast({ title: "Google sign-in failed", description, variant: "destructive" });
      // Always land on the login form on failure — never re-enter the callback.
      navigate("/admin/login", { replace: true });
    };

    const succeed = () => {
      // Session persisted. Navigate to /admin with replace so the #access_token
      // fragment is stripped THROUGH React Router (location stays in sync) and
      // the now-authenticated admin lands on the dashboard.
      setStatus("redirecting");
      navigate("/admin", { replace: true });
    };

    // A double-mount lock steal can reject setSession with an AbortError even
    // though the competing call already established the session. Never show a
    // failure until getSession confirms there is genuinely no session.
    const failUnlessSession = async (description: string, err: unknown) => {
      try {
        const { data } = await adminSupabase.auth.getSession();
        if (data.session) {
          succeed();
          return;
        }
        console.error("[auth-callback] no session after rejection — genuine failure", err);
      } catch {
        // ignore probe error — fall through to fail()
      }
      fail(description);
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

      // Broker returned an OAuth error in the fragment instead of tokens.
      if (oauthError) {
        const message = oauthErrorDescription || oauthError;
        fail(message);
        return;
      }

      // No tokens in the fragment → nothing to finalize. Back to login, never loop.
      if (!accessToken || !refreshToken) {
        fail("No sign-in token was returned. Please try again.");
        return;
      }

      try {
        // Write the session to the h4h-admin-auth store that useAuth reads.
        const { error } = await adminSupabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          // Could be a real failure OR a stolen-lock AbortError on top of a
          // session that was actually established — verify before failing.
          await failUnlessSession(error.message, error);
          return;
        }
        succeed();
      } catch (e) {
        await failUnlessSession(e instanceof Error ? e.message : String(e), e);
      }
    })();
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
