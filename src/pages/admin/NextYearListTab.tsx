import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

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
      const { data, error } = await adminSupabase
        .from("next_year_interest")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Entry[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("next_year_interest").delete().eq("id", id);
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

  const columns = useMemo<ColumnDef<Entry>[]>(() => [
    { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="font-medium">{row.original.email}</span> },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => row.original.name || <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "attended_prior_year",
      header: "Attended 2026",
      cell: ({ row }) =>
        row.original.attended_prior_year ? <Badge>Yes</Badge> : <Badge variant="outline">No</Badge>,
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => SOURCE_LABELS[row.original.source] || row.original.source,
    },
    {
      accessorKey: "created_at",
      header: "Signed up",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
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
          onClick={() => deleteOne.mutate(row.original.id)}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [deleteOne]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            2027 interest list ({totals?.total ?? 0})
          </span>
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
        ) : (
          <AdminDataTable<Entry>
            data={entries ?? []}
            columns={columns}
            urlStateKey="next_year_interest"
            searchPlaceholder="Search email, name…"
            searchKeys={["email", "name", "source"]}
            initialSort={{ id: "created_at", desc: true }}
            emptyMessage="Nothing yet. Link drops in the post-event recap at /save-the-date."
            exportFilename="next-year-interest"
          />
        )}
      </CardContent>
    </Card>
  );
}
