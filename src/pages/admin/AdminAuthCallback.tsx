import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLovableAuth } from "@/lib/adminLovableAuth";
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
      const hasToken = window.location.hash.includes("access_token");
      console.log("[auth-callback] mount", {
        hash: window.location.hash,
        hasAccessToken: hasToken,
      });

      // No token in the URL → nothing to finalize. Back to login, never loop.
      if (!hasToken) {
        console.error("[auth-callback] finalize failed: no access_token in hash");
        fail("No sign-in token was returned. Please try again.");
        return;
      }

      try {
        // Same wrapper the sign-in button uses. On the return trip (fragment
        // present) its non-redirect branch calls adminSupabase.auth.setSession,
        // writing the session to the h4h-admin-auth store that useAuth reads.
        console.log("[auth-callback] finalize path: adminLovableAuth.signInWithOAuth (re-call)");
        const result = await adminLovableAuth.signInWithOAuth("google", {
          redirect_uri: window.location.origin + "/admin/auth/callback",
        });
        console.log("[auth-callback] signInWithOAuth result", {
          hasTokens: Boolean(result.tokens),
          redirected: result.redirected,
          error: result.error,
        });
        if (cancelled) return;
        if (result.error) {
          console.error("[auth-callback] finalize failed: result.error", result.error);
          fail(String(result.error));
          return;
        }
        if (result.redirected) {
          // Not expected on the return trip; bail rather than risk a redirect loop.
          console.error("[auth-callback] finalize failed: SDK started a new redirect (result.redirected=true)");
          fail("Sign-in could not be completed. Please try again.");
          return;
        }
        // Session persisted. Navigate to /admin with replace so the #access_token
        // fragment is stripped THROUGH React Router (location stays in sync) and
        // the now-authenticated admin lands on the dashboard.
        console.log("[auth-callback] finalize success");
        setStatus("redirecting");
        navigate("/admin", { replace: true });
      } catch (e) {
        console.error("[auth-callback] finalize failed", e);
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
