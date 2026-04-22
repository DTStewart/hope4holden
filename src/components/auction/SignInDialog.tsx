import { useState } from "react";
import { bidderSupabase } from "@/integrations/supabase/bidderClient";
import { bidderLovable } from "@/integrations/lovable/bidder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Loader2, Mail, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Flip to `true` once you have an Apple Developer account + Sign in with Apple
// Services ID configured with Lovable (or via Supabase dashboard). Everything
// else (button, handler, wrapper) is already wired.
const ENABLE_APPLE_SIGNIN = false;

export function SignInDialog({ open, onOpenChange }: Props) {
  const [email, setEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [signingInWith, setSigningInWith] = useState<"google" | "microsoft" | "apple" | null>(null);

  const redirectTo = `${window.location.origin}/auction`;

  const signInWithProvider = async (provider: "google" | "microsoft" | "apple") => {
    setSigningInWith(provider);
    try {
      const result = await bidderLovable.auth.signInWithOAuth(provider, {
        redirect_uri: redirectTo,
      });
      if (result.error) {
        toast({
          title: "Couldn't start sign-in",
          description: String(result.error),
          variant: "destructive",
        });
        setSigningInWith(null);
      }
      // If result.redirected is true, the browser navigates away — nothing more to do here.
      // On return, bidderLovable writes the session to bidderSupabase automatically.
    } catch (err: any) {
      toast({ title: "Couldn't start sign-in", description: err?.message, variant: "destructive" });
      setSigningInWith(null);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    setSendingMagicLink(true);
    try {
      const { error } = await bidderSupabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch (err: any) {
      toast({ title: "Couldn't send link", description: err?.message, variant: "destructive" });
    } finally {
      setSendingMagicLink(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to bid</DialogTitle>
          <DialogDescription>
            Use any account — it's just so you can log back in later and see what you've won.
          </DialogDescription>
        </DialogHeader>

        {magicSent ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="h-12 w-12 text-primary mx-auto" />
            <p className="font-heading font-bold">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <strong>{email}</strong>. Click it from any device to continue.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={() => signInWithProvider("google")}
                disabled={!!signingInWith}
              >
                {signingInWith === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                Continue with Google
              </Button>

              <Button
                variant="outline"
                className="w-full justify-center gap-2"
                onClick={() => signInWithProvider("microsoft")}
                disabled={!!signingInWith}
              >
                {signingInWith === "microsoft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MicrosoftIcon className="h-4 w-4" />
                )}
                Continue with Microsoft
              </Button>

              {ENABLE_APPLE_SIGNIN && (
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => signInWithProvider("apple")}
                  disabled={!!signingInWith}
                >
                  {signingInWith === "apple" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AppleIcon className="h-4 w-4" />
                  )}
                  Continue with Apple
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={sendMagicLink} className="space-y-2">
              <Label htmlFor="signin-email" className="text-sm">Email a sign-in link</Label>
              <div className="flex gap-2">
                <Input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
                <Button type="submit" disabled={sendingMagicLink} size="icon">
                  {sendingMagicLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Click the link in the email — it signs you in on any device.
              </p>
            </form>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Signing in is only for tracking your bids and wins. You'll add a
              card after signing in so we can charge only if you win.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
      <rect width="10" height="10" x="1" y="1" fill="#F25022" />
      <rect width="10" height="10" x="12" y="1" fill="#7FBA00" />
      <rect width="10" height="10" x="1" y="12" fill="#00A4EF" />
      <rect width="10" height="10" x="12" y="12" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.52-2.09-.53-3.24 0-1.44.64-2.2.48-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.22 2.31-.87 3.57-.76 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4l.01-.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
