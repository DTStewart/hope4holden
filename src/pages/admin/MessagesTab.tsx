import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

interface Message {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export default function MessagesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Message[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("messages").update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      toast({ title: "Marked as read" });
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      toast({ title: "Message deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await adminSupabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-messages"] });
      toast({ title: "All messages deleted" });
    },
  });

  const unreadCount = messages?.filter((m) => !m.read).length ?? 0;

  const columns = useMemo<ColumnDef<Message>[]>(() => [
    { accessorKey: "sender_name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.sender_name}</span> },
    { accessorKey: "sender_email", header: "Email" },
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.subject || "—"}</span>,
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => <span className="block max-w-xs truncate">{row.original.message}</span>,
    },
    {
      accessorKey: "read",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.read ? "secondary" : "default"}>
          {row.original.read ? "Read" : "New"}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="space-x-1 whitespace-nowrap">
            {!m.read && (
              <Button size="sm" variant="outline" onClick={() => markRead.mutate(m.id)}>
                <Eye className="h-3 w-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne.mutate(m.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
  ], [markRead, deleteOne]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Messages ({messages?.length ?? 0})</span>
          <div className="flex gap-2 items-center">
            {unreadCount > 0 && <Badge variant="destructive">{unreadCount} unread</Badge>}
            {messages && messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all messages?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete all {messages.length} message(s). This action cannot be undone.</AlertDialogDescription>
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
        <AdminDataTable<Message>
          data={messages ?? []}
          columns={columns}
          urlStateKey="messages"
          searchPlaceholder="Search name, email, subject, body…"
          searchKeys={["sender_name", "sender_email", "subject", "message"]}
          initialSort={{ id: "created_at", desc: true }}
          emptyMessage="No messages yet."
          exportFilename="messages"
        />
      </CardContent>
    </Card>
  );
}
