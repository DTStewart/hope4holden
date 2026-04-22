import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, CheckCircle, Loader2 } from "lucide-react";

export default function SaveTheDate() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [name, setName] = useState(params.get("name") || "");
  const [attended, setAttended] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");

  // Source tag: if arriving from the recap email, mark it.
  const source = params.get("src") === "recap" ? "post_event_email" : "direct";

  const submit = async () => {
    if (!email.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }
    setStatus("saving");
    try {
      const { data, error } = await anonSupabase.rpc("add_next_year_interest", {
        _email: email.trim(),
        _name: name.trim() || null,
        _attended_prior_year: attended,
        _source: source,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) throw new Error(result?.error || "Something went wrong");
      setStatus("done");
    } catch (err) {
      console.error("[SaveTheDate] submit failed:", err);
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setStatus("idle");
    }
  };

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-16 md:py-20 animate-fade-in relative z-10 text-center">
          <CalendarDays className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="section-label">2027</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95]">
            Save your spot for next year
          </h1>
          <p className="text-white/60 mt-3 text-sm max-w-xl mx-auto">
            We open team registrations and sponsor tiers first to the 2027 list. One click and you'll
            be first to hear when dates and registration go live.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-12 md:py-16 max-w-lg">
          {status === "done" ? (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-primary mx-auto" />
                <h2 className="font-heading font-extrabold text-2xl text-foreground">You're on the list</h2>
                <p className="text-foreground/70">
                  We'll email you as soon as the 2027 tournament opens. Thanks for coming back.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="std-email">Email *</Label>
                  <Input
                    id="std-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="std-name">Name (optional)</Label>
                  <Input
                    id="std-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Smith"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="std-attended"
                    checked={attended}
                    onCheckedChange={(v) => setAttended(v === true)}
                  />
                  <Label htmlFor="std-attended" className="text-sm font-normal cursor-pointer">
                    I came to the 2026 event
                  </Label>
                </div>
                <Button
                  onClick={submit}
                  disabled={status === "saving" || !email.trim()}
                  size="lg"
                  className="w-full"
                >
                  {status === "saving" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Count me in for 2027
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
