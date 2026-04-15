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

export default function DonationsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        <CardTitle className="flex items-center justify-between">
          <span>Donations ({donations?.length ?? 0}) — ${total} total</span>
          <div className="flex gap-2">
            {donations && donations.length > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() =>
                  exportToCsv("donations.csv",
                    ["Donor", "Email", "Amount", "Recurring", "Paid", "Address", "City", "Province", "Postal Code", "Date"],
                    donations.map((d: any) => [d.donor_name, d.donor_email, String(d.amount), d.wants_recurring ? "Yes" : "No", d.paid ? "Yes" : "No", d.donor_address || "", d.donor_city || "", d.donor_province || "", d.donor_postal_code || "", new Date(d.created_at).toLocaleDateString()])
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
                    <TableCell>{d.donor_email}</TableCell>
                    <TableCell>${d.amount}</TableCell>
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
