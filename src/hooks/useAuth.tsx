import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async (userId: string) => {
    const { data, error } = await supabase.rpc("has_role", {
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
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      nextSession = data.session;
    }

    const now = Math.floor(Date.now() / 1000);
    if (nextSession?.expires_at && nextSession.expires_at - now < 60) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      nextSession = data.session;
    }

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setIsAdmin(false);
      return;
    }

    try {
      const admin = await checkAdmin(nextSession.user.id);
      setIsAdmin(admin);
    } catch {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.user) {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        throw error ?? new Error("Session expired");
      }

      setSession(data.session);
      setUser(data.session.user);
      const admin = await checkAdmin(data.session.user.id);
      setIsAdmin(admin);
    }
  }, [checkAdmin]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          await resolveSession(session);
        } catch {
          setSession(null);
          setUser(null);
          setIsAdmin(false);
        } finally {
          setLoading(false);
        }
      }
    );

    resolveSession(null)
      .catch(() => {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [resolveSession]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    window.location.href = "/admin/login";
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
