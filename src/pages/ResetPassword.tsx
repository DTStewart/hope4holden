import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearPasswordRecoveryMarker } from "@/components/PasswordRecoveryRedirect";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    const { data: { subscription } } = adminSupabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
      }
    });

    if (code) {
      adminSupabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (data.session) setSessionReady(true);
        if (error) {
          adminSupabase.auth.getSession().then(({ data: sessionData }) => {
            if (sessionData.session) setSessionReady(true);
          });
        }
      });
    }

    adminSupabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await adminSupabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    await adminSupabase.auth.signOut();
    clearPasswordRecoveryMarker();
    toast({
      title: "Password updated",
      description: "Sign in with your new password.",
    });
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading">Set New Password</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a new password for your admin account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !sessionReady}>
              {loading ? "Updating..." : sessionReady ? "Update Password" : "Preparing reset..."}
            </Button>
            <Button asChild type="button" variant="ghost" className="w-full">
              <Link to="/admin/login">Back to login</Link>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}