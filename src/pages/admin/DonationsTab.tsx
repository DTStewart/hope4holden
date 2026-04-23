import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, Mail, Loader2, Plus } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForDonation } from "@/lib/resendOrderConfirmation";
import { useState } from "react";
import WalkUpDonationDialog from "./WalkUpDonationDialog";
import { YearFilter } from "@/components/admin/YearFilter";

const METHOD_LABELS: Record<string, string> = {
  stripe: "Stripe",
  cash: "Cash",
  cheque: "Cheque",
  eft: "E-transfer",
  other: "Other",
};

export default function DonationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [walkUpOpen, setWalkUpOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const handleResend = async (d: any) => {
    setResendingId(d.id);
    try {
      await resendForDonation(d);
      toast({ title: "Confirmation email sent", description: `Sent to ${d.donor_email}` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const { data: donations, isLoading } = useQuery({
    queryKey: ["admin-donations", yearFilter],
    enabled: yearFilter != null,
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("donations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      toast({ title: "Donation deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("donations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      toast({ title: "All donations deleted" });
    },
  });

  const total = donations?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Donations ({donations?.length ?? 0}) — ${total} total</span>
          <div className="flex gap-2 flex-wrap items-center">
            <YearFilter table="donations" value={yearFilter} onChange={setYearFilter} />
            <Button size="sm" onClick={() => setWalkUpOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add walk-up
            </Button>
            {donations && donations.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() =>
                  exportToCsv("donations.csv",
                    ["Donor", "Email", "Amount", "Method", "Recurring", "Paid", "Address", "City", "Province", "Postal Code", "Admin Note", "Date"],
                    donations.map((d: any) => [d.donor_name, d.donor_email, String(d.amount), d.method || "stripe", d.wants_recurring ? "Yes" : "No", d.paid ? "Yes" : "No", d.donor_address || "", d.donor_city || "", d.donor_province || "", d.donor_postal_code || "", d.admin_note || "", new Date(d.created_at).toLocaleDateString()])
                  )
                }>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all donations?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all {donations.length} donation(s). This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteAll.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {donations?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No donations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Recurring</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations?.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.donor_name}</TableCell>
                    <TableCell>
                      <EditableEmail
                        table="donations"
                        id={d.id}
                        column="donor_email"
                        value={d.donor_email}
                        invalidateKey={["admin-donations"]}
                      />
                    </TableCell>
                    <TableCell>${d.amount}</TableCell>
                    <TableCell>
                      <Badge variant={d.method && d.method !== "stripe" ? "secondary" : "outline"}>
                        {METHOD_LABELS[d.method || "stripe"] || d.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.donor_address ? (
                        <>{d.donor_address}, {d.donor_city}, {d.donor_province} {d.donor_postal_code}</>
                      ) : (
                        <span className="italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>{d.wants_recurring ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={d.paid ? "default" : "destructive"}>{d.paid ? "Yes" : "No"}</Badge>
                    </TableCell>
                    <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        title="Resend order confirmation"
                        disabled={resendingId === d.id}
                        onClick={() => handleResend(d)}
                      >
                        {resendingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne.mutate(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <WalkUpDonationDialog open={walkUpOpen} onOpenChange={setWalkUpOpen} />
    </Card>
  );
}
