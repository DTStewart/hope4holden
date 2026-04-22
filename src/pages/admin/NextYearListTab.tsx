import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Trash2, CalendarDays } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useToast } from "@/hooks/use-toast";

type Entry = {
  id: string;
  email: string;
  name: string | null;
  attended_prior_year: boolean;
  source: string;
  created_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  post_event_email: "Recap email",
  direct: "Direct",
  other: "Other",
};

export default function NextYearListTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<Entry[]>({
    queryKey: ["admin-next-year-interest"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("next_year_interest")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Entry[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("next_year_interest").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-next-year-interest"] });
      toast({ title: "Entry removed" });
    },
  });

  const totals = entries?.reduce(
    (acc, e) => {
      acc.total++;
      if (e.attended_prior_year) acc.attended++;
      return acc;
    },
    { total: 0, attended: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            2027 interest list ({totals?.total ?? 0})
          </span>
          {entries && entries.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCsv(
                  "next-year-interest.csv",
                  ["Email", "Name", "Attended 2026", "Source", "Signed up"],
                  entries.map((e) => [
                    e.email,
                    e.name || "",
                    e.attended_prior_year ? "Yes" : "No",
                    SOURCE_LABELS[e.source] || e.source,
                    new Date(e.created_at).toLocaleDateString(),
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
        {totals && totals.total > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            {totals.attended} of {totals.total} attended the 2026 event.
          </p>
        )}
        {isLoading ? (
          <p className="text-center py-6 text-muted-foreground">Loading...</p>
        ) : !entries?.length ? (
          <p className="text-center text-muted-foreground py-6">
            Nothing yet. Link drops in the post-event recap at <code>/save-the-date</code>.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Attended 2026</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.email}</TableCell>
                  <TableCell>{e.name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {e.attended_prior_year ? (
                      <Badge>Yes</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>{SOURCE_LABELS[e.source] || e.source}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteOne.mutate(e.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
