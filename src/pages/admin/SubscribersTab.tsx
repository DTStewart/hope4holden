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

interface Subscriber {
  id: string;
  email: string;
  created_at: string;
}

export default function SubscribersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: subscribers, isLoading } = useQuery({
    queryKey: ["admin-subscribers"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("email_subscribers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Subscriber[];
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("email_subscribers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      toast({ title: "Subscriber removed" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("email_subscribers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] });
      toast({ title: "All subscribers removed" });
    },
  });

  const columns = useMemo<ColumnDef<Subscriber>[]>(() => [
    { accessorKey: "email", header: "Email", cell: ({ row }) => <span className="font-medium">{row.original.email}</span> },
    {
      accessorKey: "created_at",
      header: "Subscribed On",
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Email Subscribers ({subscribers?.length ?? 0})</span>
          {subscribers && subscribers.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete all subscribers?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete all {subscribers.length} subscriber(s). This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteAll.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AdminDataTable<Subscriber>
          data={subscribers ?? []}
          columns={columns}
          urlStateKey="subscribers"
          searchPlaceholder="Search email…"
          searchKeys={["email"]}
          initialSort={{ id: "created_at", desc: true }}
          emptyMessage="No subscribers yet."
          exportFilename="subscribers"
        />
      </CardContent>
    </Card>
  );
}
