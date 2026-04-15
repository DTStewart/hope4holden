import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_orders")
        .select("*")
        .eq("status", "completed")
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

  const allOrders = orders || [];
  const totalRevenue = allOrders.reduce((s, o) => s + o.total_amount, 0);
  const allItems = allOrders.flatMap((o) => o.items);
  const revenueByType = (type: string) =>
    allItems.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0);

  const handleExport = () => {
    if (!orders) return;
    const rows: string[][] = [];
    for (const o of orders) {
      for (const item of o.items) {
        rows.push([o.id, item.type, item.description, String(item.amount), getItemLabel(item), new Date(o.created_at).toLocaleDateString()]);
      }
    }
    exportToCsv("orders.csv", ["Order ID", "Type", "Description", "Amount", "Key Info", "Date"], rows);
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

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
          <CardTitle className="flex items-center justify-between">
            <span>Completed Orders ({allOrders.length})</span>
            <div className="flex gap-2">
              {allOrders.length > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
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
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No completed orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Stripe Session</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allOrders.map((order) => {
                    const isOpen = expanded.has(order.id);
                    return (
                      <>
                        <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggle(order.id)}>
                          <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                          <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}…</TableCell>
                          <TableCell><Badge variant="secondary">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</Badge></TableCell>
                          <TableCell className="font-medium">${order.total_amount.toLocaleString()}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{order.stripe_session_id ? `${order.stripe_session_id.slice(0, 12)}…` : "—"}</TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteOne.mutate(order.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow key={`${order.id}-detail`}>
                            <TableCell colSpan={7} className="bg-muted/30 p-0">
                              <div className="px-8 py-4 space-y-2">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-4 py-2 border-b last:border-0 border-border/50">
                                    <Badge variant={typeBadgeVariant(item.type)} className="mt-0.5 capitalize">{item.type}</Badge>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">{item.description}</p>
                                      {getItemLabel(item) && <p className="text-xs text-muted-foreground">{getItemLabel(item)}</p>}
                                    </div>
                                    <span className="text-sm font-heading font-bold">${item.amount.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
