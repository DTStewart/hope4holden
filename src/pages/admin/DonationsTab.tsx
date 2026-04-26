import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Mail, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForDonation } from "@/lib/resendOrderConfirmation";
import WalkUpDonationDialog from "./WalkUpDonationDialog";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

const METHOD_LABELS: Record<string, string> = {
  stripe: "Stripe",
  cash: "Cash",
  cheque: "Cheque",
  eft: "E-transfer",
  other: "Other",
};

interface Donation {
  id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  method: string | null;
  donor_address: string | null;
  donor_city: string | null;
  donor_province: string | null;
  donor_postal_code: string | null;
  wants_recurring: boolean;
  paid: boolean;
  created_at: string;
}

export default function DonationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [walkUpOpen, setWalkUpOpen] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const handleResend = async (d: Donation) => {
    setResendingId(d.id);
    try {
      await resendForDonation(d as any);
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
      const { data, error } = await adminSupabase
        .from("donations")
        .select("*")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Donation[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("donations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      toast({ title: "Donation deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("donations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-donations"] });
      toast({ title: "All donations deleted" });
    },
  });

  const columns = useMemo<ColumnDef<Donation>[]>(() => [
    { accessorKey: "donor_name", header: "Donor", cell: ({ row }) => <span className="font-medium">{row.original.donor_name}</span> },
    {
      accessorKey: "donor_email",
      header: "Email",
      cell: ({ row }) => (
        <EditableEmail
          table="donations"
          id={row.original.id}
          column="donor_email"
          value={row.original.donor_email}
          invalidateKey={["admin-donations"]}
        />
      ),
    },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => `$${row.original.amount}` },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => {
        const m = row.original.method || "stripe";
        return (
          <Badge variant={m !== "stripe" ? "secondary" : "outline"}>
            {METHOD_LABELS[m] || m}
          </Badge>
        );
      },
    },
    {
      id: "address",
      header: "Address",
      enableSorting: false,
      accessorFn: (d) =>
        d.donor_address
          ? `${d.donor_address}, ${d.donor_city ?? ""}, ${d.donor_province ?? ""} ${d.donor_postal_code ?? ""}`
          : "",
      cell: ({ row }) => {
        const d = row.original;
        return d.donor_address ? (
          <span className="text-xs text-muted-foreground">
            {d.donor_address}, {d.donor_city}, {d.donor_province} {d.donor_postal_code}
          </span>
        ) : (
          <span className="italic text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "wants_recurring",
      header: "Recurring",
      cell: ({ row }) => (row.original.wants_recurring ? "Yes" : "No"),
    },
    {
      accessorKey: "paid",
      header: "Paid",
      cell: ({ row }) => (
        <Badge variant={row.original.paid ? "default" : "destructive"}>{row.original.paid ? "Yes" : "No"}</Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="space-x-1 whitespace-nowrap">
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
          </div>
        );
      },
    },
  ], [resendingId, deleteOne]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const total = donations?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

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
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AdminDataTable<Donation>
          data={donations ?? []}
          columns={columns}
          urlStateKey="donations"
          searchPlaceholder="Search donor, email, address…"
          searchKeys={["donor_name", "donor_email", "donor_city", "donor_province", "donor_address"]}
          initialSort={{ id: "created_at", desc: true }}
          emptyMessage="No donations yet."
          exportFilename="donations"
        />
      </CardContent>
      <WalkUpDonationDialog open={walkUpOpen} onOpenChange={setWalkUpOpen} />
    </Card>
  );
}
