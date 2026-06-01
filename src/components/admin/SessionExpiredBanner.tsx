import { useCallback, useEffect, useState } from "react";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface SessionExpiredBannerProps {
  /** Whether the admin data query backing this view came back empty. */
  isEmpty: boolean;
  /** Refetch the underlying query once the session has been refreshed. */
  onRefetch: () => void;
}

/**
 * Inline banner shown when an admin data query returns empty AND there is no
 * valid Supabase session. A dead or expired session makes RLS silently strip
 * rows, so a table renders blank while the page itself stays up, which reads
 * as "no data" when it is really "not authenticated". This surfaces that case
 * with a one-click refresh instead.
 *
 * Deliberately NOT baked into AdminDataTable: an empty table is a legitimate
 * state when the session is healthy, so the session check below gates it. The
 * banner only renders when both the query is empty and the session is invalid.
 */
export function SessionExpiredBanner({ isEmpty, onRefetch }: SessionExpiredBannerProps) {
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const checkSession = useCallback(async () => {
    if (!isEmpty) {
      setSessionInvalid(false);
      return;
    }
    const { data, error } = await adminSupabase.auth.getSession();
    const session = data?.session ?? null;
    const now = Math.floor(Date.now() / 1000);
    const expired = !!session?.expires_at && session.expires_at <= now;
    setSessionInvalid(!!error || !session || expired);
  }, [isEmpty]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await adminSupabase.auth.refreshSession();
      onRefetch();
      await checkSession();
    } finally {
      setRefreshing(false);
    }
  };

  if (!isEmpty || !sessionInvalid) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>Session expired. Tables may appear blank until you refresh.</span>
      </div>
      <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
        {refreshing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
        Click to refresh
      </Button>
    </div>
  );
}

export default SessionExpiredBanner;
