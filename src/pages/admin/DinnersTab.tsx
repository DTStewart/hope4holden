import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export default function DinnersTab() {
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

  const totalTickets = dinners?.reduce((sum, d) => sum + d.quantity, 0) ?? 0;
  const totalRevenue = dinners?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Dinner Tickets ({totalTickets} tickets, {dinners?.length ?? 0} orders) — ${totalRevenue} total</span>
          {dinners && dinners.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCsv("dinner-tickets.csv",
                  ["Guest", "Email", "Phone", "Qty", "Amount", "Paid", "Date"],
                  dinners.map((d) => [
                    d.guest_name, d.guest_email, d.guest_phone,
                    String(d.quantity), String(d.amount),
                    d.paid ? "Yes" : "No",
                    new Date(d.created_at).toLocaleDateString(),
                  ])
                )
              }
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          )}
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
                      <Badge variant={d.paid ? "default" : "destructive"}>
                        {d.paid ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(d.created_at).toLocaleDateString()}</TableCell>
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
