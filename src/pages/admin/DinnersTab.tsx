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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForDinner } from "@/lib/resendOrderConfirmation";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

const DINNER_PRICE = 45;

interface Dinner {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  quantity: number;
  amount: number;
  paid: boolean;
  stripe_session_id: string | null;
  payment_method: string | null;
  tournament_year: number;
  created_at: string;
}

type PaymentMethod = "cash" | "cheque" | "eft" | "other";

export default function DinnersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    quantity: 1,
    payment_method: "cash" as PaymentMethod,
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () =>
    setForm({ guest_name: "", guest_email: "", guest_phone: "", quantity: 1, payment_method: "cash" });

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

  const handleAdd = async () => {
    if (!form.guest_name.trim()) {
      toast({ title: "Guest name required", variant: "destructive" });
      return;
    }
    const qty = Math.max(1, Number(form.quantity) || 1);
    setSaving(true);
    const { error } = await adminSupabase.from("dinners").insert({
      guest_name: form.guest_name.trim(),
      guest_email: form.guest_email.trim() || "",
      guest_phone: form.guest_phone.trim() || "",
      quantity: qty,
      amount: qty * DINNER_PRICE,
      paid: true,
      payment_method: form.payment_method,
      tournament_year: yearFilter ?? new Date().getFullYear(),
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to add dinner ticket", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Dinner ticket added" });
    setAddOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["admin-dinners"] });
  };

  const columns = useMemo<ColumnDef<Dinner>[]>(() => [
    {
      accessorKey: "guest_name",
      header: "Guest",
      cell: ({ row }) => {
        const d = row.original;
        const isManual = !d.stripe_session_id && d.payment_method;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{d.guest_name}</span>
            {isManual && (
              <Badge variant="secondary" className="text-xs uppercase">{d.payment_method}</Badge>
            )}
          </div>
        );
      },
    },
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
              disabled={resendingId === d.id || !d.guest_email}
              onClick={() => handleResend(d)}
            >
              {resendingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this dinner ticket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {d.guest_name} — {d.quantity} ticket(s), ${d.amount}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteOne.mutate(d.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
            <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Add dinner ticket
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add dinner ticket</DialogTitle>
                  <DialogDescription>
                    Record a dinner ticket paid outside Stripe (cash, cheque, EFT, etc.).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label htmlFor="dn-name">Guest name *</Label>
                    <Input id="dn-name" value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="dn-email">Guest email (optional)</Label>
                    <Input id="dn-email" type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="dn-phone">Guest phone (optional)</Label>
                    <Input id="dn-phone" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="dn-qty">Quantity</Label>
                      <Input id="dn-qty" type="number" min={1} value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value) || 1) })} />
                    </div>
                    <div>
                      <Label htmlFor="dn-method">Payment method</Label>
                      <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v as PaymentMethod })}>
                        <SelectTrigger id="dn-method"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="eft">EFT</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total: ${form.quantity * DINNER_PRICE} ({form.quantity} × ${DINNER_PRICE})
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
                  <Button onClick={handleAdd} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
