import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Gavel, Loader2, RefreshCw, ExternalLink, Copy } from "lucide-react";

type Invoice = {
  id: string;
  item_id: string;
  bidder_id: string;
  amount: number;
  tax_receipt_amount: number;
  status: string;
  error_message: string | null;
  payment_link_token: string | null;
  paid_at: string | null;
  notified_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  items: { title: string } | null;
  bidders: { display_name: string; email: string } | null;
};

const STATUS_VARIANTS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  charged: { label: "Charged", variant: "default" },
  pending: { label: "Pending", variant: "outline" },
  requires_action: { label: "Action needed", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  refunded: { label: "Refunded", variant: "outline" },
  manual: { label: "Manual", variant: "outline" },
};

export default function AuctionWinnersCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [closing, setClosing] = useState(false);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["admin-auction-invoices"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("auction_invoices")
        .select("*, items:auction_items(title), bidders:auction_bidders(display_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Invoice[];
    },
  });

  const runClose = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const { data, error } = await supabase.functions.invoke("auction-close", {
        body: { dryRun },
      });
      if (error) throw error;
      return data as { stats: any; details: any[] };
    },
    onSuccess: (data, dryRun) => {
      const s = data.stats;
      toast({
        title: dryRun ? "Dry run complete" : "Close complete",
        description: `Processed ${s.processed} — charged ${s.charged}, needs action ${s.requires_action}, failed ${s.failed}, no bids ${s.skipped_no_bids}`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-auction-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-auction-items"] });
    },
    onError: (err: any) => {
      toast({ title: "Close failed", description: err.message, variant: "destructive" });
    },
  });

  const resendNotification = useMutation({
    mutationFn: async (inv: Invoice) => {
      const payUrl = inv.payment_link_token
        ? `${window.location.origin}/auction/pay/${inv.payment_link_token}`
        : undefined;
      const templateName = inv.status === "charged"
        ? "auction-winner-paid"
        : "auction-winner-action-required";
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName,
          recipientEmail: inv.bidders?.email,
          idempotencyKey: `auction-resend-${inv.id}-${Date.now()}`,
          templateData: {
            recipientName: inv.bidders?.display_name,
            itemTitle: inv.items?.title,
            amount: inv.amount,
            taxReceiptAmount: inv.tax_receipt_amount,
            payUrl,
            reason: inv.status === "failed" ? "failed" : "needs_verification",
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Reminder sent" }),
    onError: (err: any) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const copyPayLink = (inv: Invoice) => {
    if (!inv.payment_link_token) return;
    const url = `${window.location.origin}/auction/pay/${inv.payment_link_token}`;
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied" }),
      () => toast({ title: "Copy failed", variant: "destructive" })
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5" />
          Winners & Settlement
        </CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => runClose.mutate(true)}
            disabled={runClose.isPending || closing}
          >
            {runClose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Dry run
          </Button>
          <AlertDialog open={closing} onOpenChange={setClosing}>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={runClose.isPending}>
                Close & settle
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close auction and charge winners?</AlertDialogTitle>
                <AlertDialogDescription>
                  This closes every item whose time has expired, determines winners by highest bid,
                  and charges each winner's saved card. Items whose anti-snipe timer is still
                  running are skipped — run this again once they close. Already-charged items are
                  skipped safely.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setClosing(false);
                    runClose.mutate(false);
                  }}
                >
                  Close & charge
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : !invoices?.length ? (
          <p className="text-sm text-muted-foreground py-4">
            No invoices yet. Once you run "Close & settle", winners will appear here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Winner</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const s = STATUS_VARIANTS[inv.status] || { label: inv.status, variant: "outline" as const };
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.items?.title || "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{inv.bidders?.display_name}</div>
                      <div className="text-xs text-muted-foreground">{inv.bidders?.email}</div>
                    </TableCell>
                    <TableCell className="text-right">${inv.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {inv.tax_receipt_amount > 0 ? `$${inv.tax_receipt_amount.toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                      {inv.error_message ? (
                        <div className="text-xs text-destructive mt-1 max-w-[220px] line-clamp-2" title={inv.error_message}>
                          {inv.error_message}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {inv.payment_link_token && inv.status !== "charged" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Copy payment link"
                            onClick={() => copyPayLink(inv)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Resend notification"
                          disabled={resendNotification.isPending}
                          onClick={() => resendNotification.mutate(inv)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        {inv.stripe_payment_intent_id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="View in Stripe"
                            asChild
                          >
                            <a
                              href={`https://dashboard.stripe.com/payments/${inv.stripe_payment_intent_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
