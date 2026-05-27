import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminSupabase } from "@/integrations/supabase/adminClient";

const RECOVERY_STORAGE_KEY = "h4h-password-recovery-active";

function hasRecoveryParams(search: string, hash: string) {
  const params = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));

  return (
    params.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    params.has("code") ||
    hashParams.has("access_token")
  );
}

export function clearPasswordRecoveryMarker() {
  sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
}

export default function PasswordRecoveryRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const target = `/reset-password${location.search}${location.hash}`;

    if (hasRecoveryParams(location.search, location.hash)) {
      sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));
      if (location.pathname !== "/reset-password") {
        navigate(target, { replace: true });
      }
    }

    const {
      data: { subscription },
    } = adminSupabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));
        if (location.pathname !== "/reset-password") {
          navigate("/reset-password", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}