import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  // Bounded auth resolution. useAuth was deliberately narrowed so it never
  // demotes an admin on a transient failure, which means a genuinely dead
  // session can leave `loading` stuck true forever and spin the page. If auth
  // has not resolved within 8s of mount, give up and treat it as
  // unauthenticated. This is a fallback timeout branch only; once auth
  // resolves (loading flips false) the existing resolved-state handling below
  // takes over unchanged.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }
    const id = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(id);
  }, [loading]);

  if (loading && timedOut) {
    return <Navigate to="/admin/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
