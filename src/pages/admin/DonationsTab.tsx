import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export default function DonationsTab() {
  const { data: donations, isLoading } = useQuery({
    queryKey: ["admin-donations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const total = donations?.reduce((sum, d) => sum + d.amount, 0) ?? 0;

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Donations ({donations?.length ?? 0}) — ${total} total</span>
          {donations && donations.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCsv("donations.csv",
                  ["Donor", "Email", "Amount", "Recurring", "Paid", "Date"],
                  donations.map((d) => [
                    d.donor_name, d.donor_email, String(d.amount),
                    d.wants_recurring ? "Yes" : "No", d.paid ? "Yes" : "No",
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
                  <TableHead>Recurring</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations?.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.donor_name}</TableCell>
                    <TableCell>{d.donor_email}</TableCell>
                    <TableCell>${d.amount}</TableCell>
                    <TableCell>{d.wants_recurring ? "Yes" : "No"}</TableCell>
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
