import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export default function WaitlistTab() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleExport = () => {
    if (!entries?.length) return;
    exportToCsv(
      "waitlist.csv",
      ["Name", "Email", "Phone", "Team Name", "Date"],
      entries.map((e) => [e.name, e.email, e.phone, e.team_name, new Date(e.created_at).toLocaleDateString()])
    );
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  const all = entries || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs text-muted-foreground font-heading uppercase tracking-wider">Total Entries</p>
          <p className="text-2xl font-heading font-extrabold">{all.length}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Waitlist ({all.length})</span>
            {all.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {all.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No waitlist entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.name}</TableCell>
                      <TableCell>{entry.email}</TableCell>
                      <TableCell>{entry.phone}</TableCell>
                      <TableCell>{entry.team_name}</TableCell>
                      <TableCell>{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
