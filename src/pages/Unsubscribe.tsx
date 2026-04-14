import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

const Unsubscribe = () => {
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const data = await res.json();
        if (!res.ok) { setStatus("invalid"); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") { setStatus("already"); return; }
        setStatus("valid");
      } catch { setStatus("error"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) { setStatus("error"); return; }
      if (data?.success) { setStatus("success"); }
      else if (data?.reason === "already_unsubscribed") { setStatus("already"); }
      else { setStatus("error"); }
    } catch { setStatus("error"); }
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
        {(status === "invalid" || status === "error") && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="font-heading font-bold text-2xl text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
