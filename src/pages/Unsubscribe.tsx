import { useState, useEffect, useCallback } from "react";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const Unsubscribe = () => {
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const validate = useCallback(async () => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    setStatus("loading");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
      const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      const data = await res.json().catch(() => ({}));
      // 404 = token genuinely doesn't exist; other non-2xx = transient/server issue
      if (res.status === 404) { setStatus("invalid"); return; }
      if (!res.ok) {
        console.error("[Unsubscribe] validate failed", { status: res.status, data });
        setStatus("error");
        return;
      }
      if (data.valid === false && data.reason === "already_unsubscribed") { setStatus("already"); return; }
      setStatus("valid");
    } catch (err) {
      console.error("[Unsubscribe] validate threw", err);
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    validate();
  }, [validate]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await anonSupabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) {
        console.error("[Unsubscribe] invoke error", error);
        setStatus("error");
        return;
      }
      if (data?.success) { setStatus("success"); }
      else if (data?.reason === "already_unsubscribed") { setStatus("already"); }
      else {
        console.error("[Unsubscribe] unexpected response", data);
        setStatus("error");
      }
    } catch (err) {
      console.error("[Unsubscribe] invoke threw", err);
      setStatus("error");
    }
    finally { setProcessing(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />}
        {status === "valid" && (
          <>
            <h1 className="font-heading font-bold text-2xl text-foreground">Unsubscribe</h1>
            <p className="text-muted-foreground">Are you sure you want to unsubscribe from Hope 4 Holden emails?</p>
            <Button onClick={handleUnsubscribe} disabled={processing} className="rounded bg-primary text-primary-foreground hover:bg-accent">
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm Unsubscribe
            </Button>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Unsubscribed</h1>
            <p className="text-muted-foreground">You have been successfully unsubscribed.</p>
          </>
        )}
        {status === "already" && (
          <>
            <CheckCircle className="h-14 w-14 text-muted-foreground mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Already Unsubscribed</h1>
            <p className="text-muted-foreground">You've already been unsubscribed from these emails.</p>
          </>
        )}
        {status === "invalid" && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Something went wrong</h1>
            <p className="text-muted-foreground">
              We couldn't process your unsubscribe right now. Please try again, or email{" "}
              <a href="mailto:hello@hope4holden.com" className="text-primary underline">hello@hope4holden.com</a>.
            </p>
            <Button onClick={validate} variant="outline" className="rounded">
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
