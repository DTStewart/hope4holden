import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { adminLovableAuth } from "@/lib/adminLovableAuth";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

// Magic-link emails must land on the production admin origin, not the
// lovable.app preview origin, otherwise the session is written to the wrong
// localStorage and /admin can never see it.
const MAGIC_LINK_REDIRECT = "https://hope4holden.com/admin";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return params.get("type") === "recovery" || hashParams.get("type") === "recovery" || params.has("code");
  });
  const { signIn, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleMagicLink = async () => {
    if (!email.includes("@")) {
      toast({ title: "Enter your admin email above first", variant: "destructive" });
      return;
    }
    setMagicLoading(true);
    const { error } = await adminSupabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: MAGIC_LINK_REDIRECT, shouldCreateUser: false },
    });
    setMagicLoading(false);
    if (error) {
      toast({ title: "Couldn't send link", description: error.message, variant: "destructive" });
      return;
    }
    setMagicSent(true);
    toast({
      title: "Check your email",
      description: `A sign-in link was sent to ${email.trim()}. Open it on this device.`,
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    if (params.get("type") === "recovery" || hashParams.get("type") === "recovery" || params.has("code")) {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      return;
    }

    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
        setIsResetMode(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // If already logged in as admin, redirect
  if (user && isAdmin && !isRecoveryMode) {
    navigate("/admin", { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Auth state change will trigger re-render, then redirect
      navigate("/admin", { replace: true });
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await adminSupabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);

    if (error) {
      toast({
        title: "Reset email failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Check your email",
      description: "A password reset link has been sent if that admin account exists.",
    });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    const { error } = await adminSupabase.auth.updateUser({ password: newPassword });
    setResetLoading(false);

    if (error) {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Password updated",
      description: "Sign in with your new password.",
    });
    setPassword("");
    setNewPassword("");
    setIsRecoveryMode(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading">
            {isRecoveryMode ? "Set New Password" : isResetMode ? "Reset Password" : "Admin Login"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isRecoveryMode
              ? "Choose a new password for your admin account"
              : isResetMode
                ? "Send a secure reset link to your admin email"
                : "Sign in to manage the Hope 4 Holden tournament"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRecoveryMode ? (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          ) : isResetMode ? (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Admin email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@hope4holden.com"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                <Mail className="h-4 w-4" />
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setIsResetMode(false)}>
                Back to login
              </Button>
            </form>
          ) : (
            <>
          <Button
            variant="outline"
            className="w-full"
            type="button"
            onClick={async () => {
              const result = await adminLovableAuth.signInWithOAuth("google", {
                redirect_uri: window.location.origin + "/admin",
              });
              if (result.error) {
                toast({
                  title: "Google sign-in failed",
                  description: String(result.error),
                  variant: "destructive",
                });
              }
            }}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@hope4holden.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleMagicLink}
              disabled={magicLoading || magicSent}
            >
              <Mail className="h-4 w-4 mr-2" />
              {magicSent
                ? "Link sent — check your email"
                : magicLoading
                  ? "Sending link..."
                  : "Email me a sign-in link"}
            </Button>
            <Button type="button" variant="link" className="w-full" onClick={() => setIsResetMode(true)}>
              Forgot password?
            </Button>
          </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
