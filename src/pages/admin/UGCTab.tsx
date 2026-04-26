import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Image as ImageIcon, Trash2 } from "lucide-react";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

type Photo = {
  id: string;
  registration_id: string;
  photo_url: string;
  caption: string | null;
  status: "pending" | "approved" | "rejected";
  submitter_note: string | null;
  admin_note: string | null;
  created_at: string;
  registrations: { team_name: string } | null;
  // Flattened fields for searching/sorting
  team_name?: string;
};

type Filter = "pending" | "approved" | "rejected" | "all";

export default function UGCTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("pending");
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  const { data: photos, isLoading } = useQuery<Photo[]>({
    queryKey: ["admin-ugc", filter],
    queryFn: async () => {
      await ensureAdminSession();
      let query = adminSupabase
        .from("ugc_photos")
        .select("*, registrations(team_name)")
        .order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return ((data || []) as unknown as Photo[]).map((p) => ({
        ...p,
        team_name: p.registrations?.team_name || "",
      }));
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await adminSupabase.from("ugc_photos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ugc"] });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("ugc_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ugc"] });
      toast({ title: "Photo removed" });
    },
  });

  const counts = photos?.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const columns = useMemo<ColumnDef<Photo>[]>(() => [
    {
      id: "photo",
      header: "Photo",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setOpenPhoto(row.original.photo_url)}
          className="block h-14 w-20 bg-muted rounded overflow-hidden border border-border hover:opacity-80 transition-opacity"
        >
          <img src={row.original.photo_url} alt="" className="h-full w-full object-cover" />
        </button>
      ),
    },
    {
      accessorKey: "team_name",
      header: "Team",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.team_name || "—"}</span>
      ),
    },
    {
      accessorKey: "caption",
      header: "Caption",
      cell: ({ row }) =>
        row.original.caption ? (
          <span className="block max-w-xs text-sm line-clamp-2">{row.original.caption}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "approved"
              ? "default"
              : row.original.status === "rejected"
              ? "destructive"
              : "outline"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Submitted",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(row.original.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex gap-1 justify-end whitespace-nowrap">
            {p.status !== "approved" && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setStatus.mutate({ id: p.id, status: "approved" })}
                disabled={setStatus.isPending}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            {p.status !== "rejected" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus.mutate({ id: p.id, status: "rejected" })}
                disabled={setStatus.isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => deleteOne.mutate(p.id)}
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ], [setStatus, deleteOne]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              User-generated photos
            </span>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {counts && (
            <p className="text-sm text-muted-foreground mb-4">
              {counts.pending || 0} pending · {counts.approved || 0} approved · {counts.rejected || 0} rejected
            </p>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading…</div>
          ) : (
            <AdminDataTable<Photo>
              data={photos ?? []}
              columns={columns}
              urlStateKey="ugc"
              searchPlaceholder="Search team, caption…"
              searchKeys={["team_name", "caption", "submitter_note"]}
              initialSort={{ id: "created_at", desc: true }}
              emptyMessage={filter === "pending" ? "No pending photos." : `No ${filter} photos.`}
              exportFilename="ugc-photos"
            />
          )}
        </CardContent>
      </Card>

      {openPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpenPhoto(null)}
          role="dialog"
        >
          <img src={openPhoto} alt="" className="max-h-[90vh] max-w-full rounded shadow-2xl" />
          <button
            type="button"
            onClick={() => setOpenPhoto(null)}
            className="absolute top-4 right-4 bg-white/10 text-white rounded-full h-10 w-10 flex items-center justify-center text-xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
