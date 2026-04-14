import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

export default function RegistrationsTab() {
  const { data: registrations, isLoading } = useQuery({
    queryKey: ["admin-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Registrations ({registrations?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {registrations?.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No registrations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations?.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.team_name}</TableCell>
                    <TableCell>{reg.captain_name}</TableCell>
                    <TableCell>{reg.captain_email}</TableCell>
                    <TableCell>{reg.captain_phone}</TableCell>
                    <TableCell>
                      <Badge variant={reg.status === "confirmed" ? "default" : "secondary"}>
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={reg.paid ? "default" : "destructive"}>
                        {reg.paid ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(reg.created_at).toLocaleDateString()}</TableCell>
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
