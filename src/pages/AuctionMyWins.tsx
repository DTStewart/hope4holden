import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { bidderSupabase } from "@/integrations/supabase/bidderClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Gavel, ExternalLink, ArrowLeft } from "lucide-react";
import { useBidderSession } from "@/hooks/useBidderSession";

type MyInvoice = {
  id: string;
  item_id: string;
  item_title: string;
  amount: number;
  status: string;
  payment_link_token: string | null;
  paid_at: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  charged: { label: "Paid", className: "bg-primary/15 text-primary border-primary/30" },
  pending: { label: "Processing", className: "bg-muted text-muted-foreground" },
  requires_action: { label: "Action needed", className: "bg-amber-100 text-amber-900 border-amber-300" },
  failed: { label: "Payment failed", className: "bg-destructive/10 text-destructive border-destructive/30" },
  refunded: { label: "Refunded", className: "bg-muted text-muted-foreground" },
  manual: { label: "Paid (manual)", className: "bg-primary/15 text-primary border-primary/30" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export default function AuctionMyWins() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useBidderSession();
  const [invoices, setInvoices] = useState<MyInvoice[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await bidderSupabase.rpc("my_auction_invoices");
        if (error) throw error;
        setInvoices((data as MyInvoice[]) || []);
      } catch (err) {
        console.error("[my-wins] lookup failed:", err);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [session, sessionLoading]);

  if (sessionLoading || loading) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="section-light">
        <div className="container py-20 md:py-28 max-w-lg mx-auto text-center space-y-4">
          <Gavel className="h-14 w-14 text-muted-foreground mx-auto" />
          <h1 className="font-heading font-extrabold text-3xl text-foreground">Not signed in</h1>
          <p className="text-foreground/60">
            Sign in on the auction page to see your wins and payment status.
          </p>
          <Button onClick={() => navigate("/auction")}>Go to the auction</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <section className="section-dark relative overflow-hidden">
        <div className="container py-12 md:py-16 animate-fade-in relative z-10">
          <Link to="/auction" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to auction
          </Link>
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight">
            My auction activity
          </h1>
          <p className="text-white/60 mt-2 text-sm">
            Every item you've won and its payment status.
          </p>
        </div>
      </section>

      <section className="section-light">
        <div className="container py-12 md:py-16 max-w-3xl">
          {(invoices?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-foreground/60">
                You haven't won anything yet. Keep an eye on the auction — bidding closes at the Thursday dinner.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invoices!.map((inv) => {
                const badge = STATUS_BADGE[inv.status] || { label: inv.status, className: "bg-muted text-muted-foreground" };
                const payUrl =
                  inv.payment_link_token && (inv.status === "requires_action" || inv.status === "failed" || inv.status === "pending")
                    ? `/auction/pay/${inv.payment_link_token}`
                    : null;
                return (
                  <Card key={inv.id}>
                    <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="font-heading font-bold text-foreground">{inv.item_title}</h3>
                        <p className="text-xs text-foreground/50 mt-1">
                          Won {formatDate(inv.created_at)}
                          {inv.paid_at ? ` · Paid ${formatDate(inv.paid_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-heading font-extrabold text-xl text-foreground">
                            ${inv.amount.toLocaleString()}
                          </div>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </div>
                        {payUrl && (
                          <Button asChild size="sm">
                            <Link to={payUrl}>
                              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Pay now
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
