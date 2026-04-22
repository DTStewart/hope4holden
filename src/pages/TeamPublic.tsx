import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { anonSupabase } from "@/integrations/supabase/anonClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, Heart, Users, ArrowRight } from "lucide-react";

type Team = {
  registration_id: string;
  team_name: string;
  business_name: string | null;
  team_slug: string;
  team_photo_url: string | null;
  member_first_names: string[];
  team_fundraising_total: number;
};

export default function TeamPublic() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, setDrawerOpen } = useCart();

  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [team, setTeam] = useState<Team | null>(null);
  const [amount, setAmount] = useState<number | null>(50);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (!slug) {
      setStatus("notfound");
      return;
    }
    (async () => {
      try {
        const { data, error } = await anonSupabase.rpc("get_team_public", { _slug: slug });
        if (error) throw error;
        const first = Array.isArray(data) ? data[0] : data;
        if (!first) {
          setStatus("notfound");
          return;
        }
        setTeam(first as Team);
        setStatus("ready");
      } catch (err: any) {
        console.error("[TeamPublic] load failed:", err);
        setStatus("error");
      }
    })();
  }, [slug]);

  const suggested = [25, 50, 100, 250];

  const donate = () => {
    if (!team) return;
    const donationAmount = isCustom ? Number(customAmount) : amount;
    if (!donationAmount || donationAmount < 5) {
      toast({ title: "Please enter at least $5", variant: "destructive" });
      return;
    }
    addItem({
      type: "donation",
      description: `Donation to Team ${team.team_name}`,
      amount: donationAmount,
      formData: { amount: donationAmount, teamSlug: team.team_slug },
    });
    toast({ title: "Added to cart", description: `$${donationAmount} donation attributed to ${team.team_name}` });
    setDrawerOpen(true);
    navigate("/checkout");
  };

  if (status === "loading") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <AlertCircle className="h-14 w-14 text-destructive mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Team not found</h1>
          <p className="text-foreground/60">
            This team link may have changed. Browse all ways to support Hope 4 Holden:
          </p>
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!team) return null;

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        {team.team_photo_url ? (
          <img
            src={team.team_photo_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        ) : null}
        <div className="container py-16 md:py-20 animate-fade-in relative z-10">
          <p className="section-label">Playing for Hope 4 Holden</p>
          <h1 className="font-heading font-extrabold text-4xl md:text-6xl text-white leading-[0.95] mt-1">
            {team.team_name}
          </h1>
          {team.business_name && team.business_name !== team.team_name && (
            <p className="text-white/60 mt-2 text-base">{team.business_name}</p>
          )}
        </div>
      </section>

      <section className="section-light">
        <div className="container py-10 md:py-14 max-w-2xl space-y-6">

          {team.team_photo_url && (
            <img
              src={team.team_photo_url}
              alt={team.team_name}
              className="w-full rounded object-cover aspect-video"
            />
          )}

          <Card>
            <CardContent className="py-6 space-y-4 text-center">
              <Heart className="h-10 w-10 text-primary mx-auto" />
              <h2 className="font-heading font-extrabold text-2xl text-foreground">
                Help {team.team_name} raise more
              </h2>
              <p className="text-sm text-foreground/70 max-w-md mx-auto">
                Every dollar donated here is attributed to this team and goes directly to A-T research through the
                Ataxia Telangiectasia Children's Project. Canadian tax receipts issued by ATCP.
              </p>

              <div className="bg-primary/5 border border-primary/20 rounded p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Raised so far</p>
                <p className="font-heading font-extrabold text-3xl text-primary mt-1">
                  ${team.team_fundraising_total.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2">
                {suggested.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={!isCustom && amount === a ? "default" : "outline"}
                    onClick={() => { setAmount(a); setIsCustom(false); }}
                  >
                    ${a}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/60">$</span>
                  <input
                    type="number"
                    min={5}
                    step={1}
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setIsCustom(true); }}
                    onFocus={() => setIsCustom(true)}
                    placeholder="Custom amount"
                    className="w-full pl-7 pr-3 py-2 border border-[#1A1A1A]/15 rounded text-foreground"
                  />
                </div>
              </div>

              <Button onClick={donate} size="lg" className="w-full">
                Donate <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-foreground/50">
                Secure checkout by Stripe. Canadian tax receipt available for donations above 125% of fair market
                value (items don't apply here — 100% receiptable via ATCP).
              </p>
            </CardContent>
          </Card>

          {team.member_first_names.length > 0 && (
            <Card>
              <CardContent className="py-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5" /> The team
                </p>
                <p className="text-sm text-foreground/80">
                  {team.member_first_names.join(", ")} — playing for Holden.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </section>
    </div>
  );
}
