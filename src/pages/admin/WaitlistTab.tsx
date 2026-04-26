import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string;
  team_name: string;
  created_at: string;
}

export default function WaitlistTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WaitlistEntry[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("waitlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-waitlist"] });
      toast({ title: "Entry deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("waitlist").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-waitlist"] });
      toast({ title: "All waitlist entries deleted" });
    },
  });

  const columns = useMemo<ColumnDef<WaitlistEntry>[]>(() => [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "team_name", header: "Team Name" },
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
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne.mutate(row.original.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
    },
  ], [deleteOne]);

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
            <div className="flex gap-2">
              {all.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all waitlist entries?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete all {all.length} waitlist entry/entries. This action cannot be undone.</AlertDialogDescription>
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
          <AdminDataTable<WaitlistEntry>
            data={all}
            columns={columns}
            urlStateKey="waitlist"
            searchPlaceholder="Search name, email, team…"
            searchKeys={["name", "email", "phone", "team_name"]}
            initialSort={{ id: "created_at", desc: true }}
            emptyMessage="No waitlist entries yet."
            exportFilename="waitlist"
          />
        </CardContent>
      </Card>
    </div>
  );
}
