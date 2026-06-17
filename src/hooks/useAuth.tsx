import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from "react";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A real auth failure — JWT invalid/expired, session lost — should wipe
// state and bounce the user to login. A transient failure (network blip,
// PostgREST 5xx, GoTrue lock contention) should NOT.
function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  return status === 401 || /session|token/i.test(msg);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (userId: string) => {
    const { data, error } = await adminSupabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (error) {
      throw error;
    }

    return !!data;
  }, []);

  const resolveSession = useCallback(async (incomingSession: Session | null) => {
    let nextSession = incomingSession;

    if (!nextSession) {
      const { data, error } = await adminSupabase.auth.getSession();
      if (error) throw error;
      nextSession = data.session;
    }

    // Pre-emptive expires_at / refreshSession removed. autoRefreshToken on
    // the admin client (see src/integrations/supabase/client.ts) handles
    // refresh automatically. A manual refresh here races onAuthStateChange,
    // which also fires on mount — whichever loses the race could wipe state.

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setIsAdmin(false);
      return;
    }

    try {
      const admin = await checkAdmin(nextSession.user.id);
      setIsAdmin(admin);
    } catch (err) {
      if (isAuthError(err)) {
        // Real auth failure — try one refresh, and if that fails too wipe state.
        console.warn("[useAuth] auth error in has_role — attempting refresh:", err);
        const { data, error } = await adminSupabase.auth.refreshSession();
        if (error || !data.session?.user) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          throw error ?? new Error("Session expired");
        }

        setSession(data.session);
        setUser(data.session.user);
        try {
          const admin = await checkAdmin(data.session.user.id);
          setIsAdmin(admin);
        } catch (retryErr) {
          if (isAuthError(retryErr)) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            throw retryErr;
          }
          console.warn(
            "[useAuth] has_role failed non-auth after refresh — keeping previous isAdmin:",
            retryErr
          );
        }
      } else {
        // Transient error: retry once after 500ms. If the retry also fails
        // non-auth, leave isAdmin at its previous value — do NOT demote.
        console.warn("[useAuth] transient error in has_role — retrying in 500ms:", err);
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const admin = await checkAdmin(nextSession.user.id);
          setIsAdmin(admin);
        } catch (retryErr) {
          if (isAuthError(retryErr)) {
            // Retry surfaced a real auth problem — wipe.
            console.warn("[useAuth] retry surfaced auth error — wiping session:", retryErr);
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            throw retryErr;
          }
          console.warn(
            "[useAuth] has_role retry also failed non-auth — keeping previous isAdmin:",
            retryErr
          );
        }
      }
    }
  }, [checkAdmin]);

  useEffect(() => {
    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (_event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
          return;
        }

        try {
          await resolveSession(session);
        } catch (err) {
          if (isAuthError(err)) {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
          } else {
            console.warn("[useAuth] transient error resolving session:", err);
          }
        } finally {
          setLoading(false);
        }
      }
    );

    resolveSession(null)
      .catch((err) => {
        if (isAuthError(err)) {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        } else {
          console.warn("[useAuth] transient error on initial session resolution:", err);
        }
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [resolveSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await adminSupabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await adminSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    window.location.href = "/admin/login";
  }, []);

  const value = useMemo(
    () => ({ user, session, isAdmin, loading, signIn, signOut }),
    [user, session, isAdmin, loading, signIn, signOut]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
