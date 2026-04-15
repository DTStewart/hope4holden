import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2 } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function DinnersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dinners, isLoading } = useQuery({
    queryKey: ["admin-dinners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dinners")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dinners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dinners"] });
      toast({ title: "Dinner ticket deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dinners").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dinners"] });
      toast({ title: "All dinner tickets deleted" });
    },
  });

  const totalTickets = dinners?.reduce((sum, d) => sum + d.quantity, 0) ?? 0;
  const totalRevenue = dinners?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Dinner Tickets ({totalTickets} tickets, {dinners?.length ?? 0} orders) — ${totalRevenue} total</span>
          <div className="flex gap-2">
            {dinners && dinners.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() =>
                  exportToCsv("dinner-tickets.csv",
                    ["Guest", "Email", "Phone", "Qty", "Amount", "Paid", "Date"],
                    dinners.map((d) => [d.guest_name, d.guest_email, d.guest_phone, String(d.quantity), String(d.amount), d.paid ? "Yes" : "No", new Date(d.created_at).toLocaleDateString()])
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
                      <AlertDialogTitle>Delete all dinner tickets?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all {dinners.length} dinner ticket order(s). This action cannot be undone.</AlertDialogDescription>
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
        {dinners?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No dinner ticket orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dinners?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.guest_name}</TableCell>
                    <TableCell>{d.guest_email}</TableCell>
                    <TableCell>{d.guest_phone}</TableCell>
                    <TableCell>{d.quantity}</TableCell>
                    <TableCell>${d.amount}</TableCell>
                    <TableCell>
                      <Badge variant={d.paid ? "default" : "destructive"}>{d.paid ? "Yes" : "No"}</Badge>
                    </TableCell>
                    <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
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
    </Card>
  );
}
