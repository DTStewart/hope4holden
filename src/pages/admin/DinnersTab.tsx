import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Mail, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForDinner } from "@/lib/resendOrderConfirmation";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

interface Dinner {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  quantity: number;
  amount: number;
  paid: boolean;
  created_at: string;
}

export default function DinnersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const handleResend = async (d: Dinner) => {
    setResendingId(d.id);
    try {
      await resendForDinner(d as any);
      toast({ title: "Confirmation email sent", description: `Sent to ${d.guest_email}` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const { data: dinners, isLoading } = useQuery({
    queryKey: ["admin-dinners", yearFilter],
    enabled: yearFilter != null,
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("dinners")
        .select("*")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dinner[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("dinners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dinners"] });
      toast({ title: "Dinner ticket deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("dinners").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dinners"] });
      toast({ title: "All dinner tickets deleted" });
    },
  });

  const columns = useMemo<ColumnDef<Dinner>[]>(() => [
    { accessorKey: "guest_name", header: "Guest", cell: ({ row }) => <span className="font-medium">{row.original.guest_name}</span> },
    {
      accessorKey: "guest_email",
      header: "Email",
      cell: ({ row }) => (
        <EditableEmail
          table="dinners"
          id={row.original.id}
          column="guest_email"
          value={row.original.guest_email}
          invalidateKey={["admin-dinners"]}
        />
      ),
    },
    { accessorKey: "guest_phone", header: "Phone" },
    { accessorKey: "quantity", header: "Qty" },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => `$${row.original.amount}` },
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

  const totalTickets = dinners?.reduce((sum, d) => sum + d.quantity, 0) ?? 0;
  const totalRevenue = dinners?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Dinner Tickets ({totalTickets} tickets, {dinners?.length ?? 0} orders) — ${totalRevenue} total</span>
          <div className="flex gap-2 flex-wrap items-center">
            <YearFilter table="dinners" value={yearFilter} onChange={setYearFilter} />
            {dinners && dinners.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all dinner tickets?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete all {dinners.length} dinner ticket order(s). This action cannot be undone.</AlertDialogDescription>
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
        <AdminDataTable<Dinner>
          data={dinners ?? []}
          columns={columns}
          urlStateKey="dinners"
          searchPlaceholder="Search guest, email, phone…"
          searchKeys={["guest_name", "guest_email", "guest_phone"]}
          initialSort={{ id: "created_at", desc: true }}
          emptyMessage="No dinner ticket orders yet."
          exportFilename="dinner-tickets"
        />
      </CardContent>
    </Card>
  );
}
