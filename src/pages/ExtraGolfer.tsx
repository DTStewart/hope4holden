import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
// TODO: post-tournament, switch to anonSupabase. This page is public and has no
// admin session — it shouldn't share localStorage with the admin client. Kept
// on adminSupabase here only to make the refactor behavior-preserving.
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users } from "lucide-react";

const PRICE_PER_GOLFER = 150;

interface Invite {
  id: string;
  token: string;
  golfer_count: number;
  price_per_golfer: number;
  golfing_with: string | null;
  used: boolean;
}

export default function ExtraGolfer() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [golfingWith, setGolfingWith] = useState("");
  const [golfers, setGolfers] = useState<{ name: string; email: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("Invalid link.");
        setLoading(false);
        return;
      }
      const { data, error: rpcError } = await adminSupabase.rpc("lookup_extra_golfer_invite", {
        _token: token,
      });
      if (rpcError) {
        setError("Could not load this link. Please contact us.");
        setLoading(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) {
        setError("This payment link wasn't found. Please double-check the URL.");
        setLoading(false);
        return;
      }
      if (row.used) {
        setError("This payment link has already been used. If you need help, please contact us.");
        setLoading(false);
        return;
      }
      setInvite(row as Invite);
      setGolfingWith(row.golfing_with ?? "");
      setGolfers(Array.from({ length: row.golfer_count }, () => ({ name: "" })));
      setLoading(false);
    })();
  }, [token]);

  const total = useMemo(() => {
    if (!invite) return 0;
    return invite.golfer_count * PRICE_PER_GOLFER;
  }, [invite]);

  const updateGolferName = (idx: number, name: string) => {
    setGolfers((prev) => prev.map((g, i) => (i === idx ? { name } : g)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    if (!contact.name.trim() || !contact.email.trim() || !contact.phone.trim()) {
      toast({ title: "Please fill in your contact info", variant: "destructive" });
      return;
    }
    if (golfers.some((g) => !g.name.trim())) {
      toast({ title: "Please enter every golfer's name", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await adminSupabase.functions.invoke("create-checkout", {
        body: {
          items: [
            {
              type: "extra_golfers",
              description: `${invite.golfer_count} Extra Golfer${invite.golfer_count > 1 ? "s" : ""}`,
              amount: total,
              formData: {
                inviteToken: invite.token,
                golferCount: invite.golfer_count,
                golfers: golfers.map((g) => ({ name: g.name.trim() })),
                golfingWith: golfingWith.trim() || null,
                contactName: contact.name.trim(),
                contactEmail: contact.email.trim(),
                contactPhone: contact.phone.trim(),
              },
            },
          ],
          returnUrl: `${window.location.origin}/extra-golfer/${invite.token}`,
        },
      });

      if (fnError) throw fnError;
      if (!data?.url) throw new Error("No checkout URL returned");

      window.location.href = data.url;
    } catch (err: any) {
      toast({
        title: "Could not start checkout",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-2">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-wide">Hope 4 Holden Golf Tournament</span>
            </div>
            <CardTitle className="text-2xl">
              Pay for {invite.golfer_count} Extra Golfer{invite.golfer_count > 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              ${PRICE_PER_GOLFER} per golfer • Total: <span className="font-semibold text-foreground">${total}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact info */}
              <div className="space-y-3">
                <h3 className="font-semibold">Your contact info</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="contactName">Full name *</Label>
                    <Input
                      id="contactName"
                      value={contact.name}
                      onChange={(e) => setContact({ ...contact, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Phone *</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="contactEmail">Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contact.email}
                    onChange={(e) => setContact({ ...contact, email: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">We'll send your receipt here.</p>
                </div>
              </div>

              {/* Golfer names */}
              <div className="space-y-3">
                <h3 className="font-semibold">Golfer name{invite.golfer_count > 1 ? "s" : ""}</h3>
                {golfers.map((g, i) => (
                  <div key={i}>
                    <Label htmlFor={`golfer-${i}`}>Golfer {i + 1} *</Label>
                    <Input
                      id={`golfer-${i}`}
                      value={g.name}
                      onChange={(e) => updateGolferName(i, e.target.value)}
                      placeholder="Full name"
                      required
                    />
                  </div>
                ))}
              </div>

              {/* Golfing with */}
              <div>
                <Label htmlFor="golfingWith">Who are you golfing with?</Label>
                <Input
                  id="golfingWith"
                  value={golfingWith}
                  onChange={(e) => setGolfingWith(e.target.value)}
                  placeholder="e.g. team name, captain's name, or company"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Helps us match you with the right team on tournament day. Skip if you're not sure.
                </p>
              </div>

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Redirecting to checkout…
                  </>
                ) : (
                  <>Pay ${total}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
