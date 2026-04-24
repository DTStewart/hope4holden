import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

interface OrderItem {
  type: string;
  description: string;
  amount: number;
  formData?: Record<string, any>;
}

interface Order {
  id: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
}

function getItemLabel(item: OrderItem) {
  const fd = item.formData || {};
  if (item.type === "registration") return fd.teamName || fd.captainName || "";
  if (item.type === "sponsorship") return fd.businessName || fd.contactName || "";
  if (item.type === "donation") return fd.donorName || fd.donorEmail || "";
  return "";
}

function typeBadgeVariant(type: string) {
  if (type === "registration") return "default" as const;
  if (type === "sponsorship") return "secondary" as const;
  return "outline" as const;
}

export default function OrdersTab() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders", yearFilter],
    enabled: yearFilter != null,
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("pending_orders")
        .select("*")
        .eq("status", "completed")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((o) => ({
        ...o,
        items: (Array.isArray(o.items) ? o.items : []) as unknown as OrderItem[],
      })) as Order[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pending_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Order deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pending_orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "All orders deleted" });
    },
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Searchable representation of items so search can hit team/business/donor names within items
  const flattenedOrders = useMemo(() => {
    return (orders ?? []).map((o) => ({
      ...o,
      _items_search: o.items
        .map((i) => `${i.type} ${i.description} ${getItemLabel(i)}`)
        .join(" "),
    }));
  }, [orders]);

  const columns = useMemo<ColumnDef<Order & { _items_search: string }>[]>(() => [
    {
      accessorKey: "id",
      header: "Order ID",
      cell: ({ row }) => {
        const order = row.original;
        const isOpen = expanded.has(order.id);
        return (
          <button
            type="button"
            onClick={() => toggle(order.id)}
            className="inline-flex items-center gap-2 font-mono text-xs hover:text-foreground"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {order.id.slice(0, 8)}…
          </button>
        );
      },
    },
    {
      id: "items",
      header: "Items",
      enableSorting: false,
      accessorFn: (o) => o.items.length,
      cell: ({ row }) => {
        const order = row.original;
        const isOpen = expanded.has(order.id);
        return (
          <div className="space-y-2">
            <Badge variant="secondary">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </Badge>
            {isOpen && (
              <div className="bg-muted/30 rounded p-3 space-y-2 mt-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-1.5 border-b last:border-0 border-border/50">
                    <Badge variant={typeBadgeVariant(item.type)} className="mt-0.5 capitalize">{item.type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.description}</p>
                      {getItemLabel(item) && <p className="text-xs text-muted-foreground">{getItemLabel(item)}</p>}
                    </div>
                    <span className="text-sm font-heading font-bold">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "total_amount",
      header: "Total",
      cell: ({ row }) => <span className="font-medium">${row.original.total_amount.toLocaleString()}</span>,
    },
    {
      accessorKey: "stripe_session_id",
      header: "Stripe Session",
      cell: ({ row }) =>
        row.original.stripe_session_id ? (
          <span className="font-mono text-xs text-muted-foreground">{row.original.stripe_session_id.slice(0, 12)}…</span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); deleteOne.mutate(row.original.id); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
    },
  ], [expanded, deleteOne]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const allOrders = orders || [];
  const totalRevenue = allOrders.reduce((s, o) => s + o.total_amount, 0);
  const allItems = allOrders.flatMap((o) => o.items);
  const revenueByType = (type: string) =>
    allItems.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Total Orders</p><p className="text-2xl font-heading font-extrabold">{allOrders.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Total Revenue</p><p className="text-2xl font-heading font-extrabold text-primary">${totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Registrations</p><p className="text-2xl font-heading font-extrabold">${revenueByType("registration").toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Sponsorships</p><p className="text-2xl font-heading font-extrabold">${revenueByType("sponsorship").toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Donations</p><p className="text-2xl font-heading font-extrabold">${revenueByType("donation").toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Completed Orders ({allOrders.length})</span>
            <div className="flex gap-2 flex-wrap items-center">
              <YearFilter table="pending_orders" value={yearFilter} onChange={setYearFilter} />
              {allOrders.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all orders?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all {allOrders.length} order(s). This action cannot be undone.</AlertDialogDescription>
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
          <AdminDataTable
            data={flattenedOrders}
            columns={columns}
            urlStateKey="orders"
            searchPlaceholder="Search by ID, item, name…"
            searchKeys={["id", "stripe_session_id", "_items_search"] as any}
            initialSort={{ id: "created_at", desc: true }}
            emptyMessage="No completed orders yet."
            exportFilename="orders"
          />
        </CardContent>
      </Card>
    </div>
  );
}
