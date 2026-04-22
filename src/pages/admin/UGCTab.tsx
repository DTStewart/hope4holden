import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";

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
      let query = supabase
        .from("ugc_photos")
        .select("*, registrations(team_name)")
        .order("created_at", { ascending: false });
      if (filter !== "all") query = query.eq("status", filter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Photo[];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("ugc_photos").update({ status }).eq("id", id);
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
      const { error } = await supabase.from("ugc_photos").delete().eq("id", id);
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              User-generated photos
            </span>
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-48">
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !photos?.length ? (
            <p className="text-center text-muted-foreground py-8">
              {filter === "pending" ? "No pending photos." : `No ${filter} photos.`}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((p) => (
                <div key={p.id} className="border rounded-lg overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => setOpenPhoto(p.photo_url)}
                    className="block w-full aspect-[4/3] bg-muted overflow-hidden"
                  >
                    <img src={p.photo_url} alt="" className="h-full w-full object-cover hover:opacity-90 transition-opacity" />
                  </button>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{p.registrations?.team_name || "—"}</span>
                      <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "outline"}>
                        {p.status}
                      </Badge>
                    </div>
                    {p.caption && <p className="text-sm text-foreground/80 line-clamp-3">{p.caption}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-2 pt-1">
                      {p.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1"
                          onClick={() => setStatus.mutate({ id: p.id, status: "approved" })}
                          disabled={setStatus.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Approve
                        </Button>
                      )}
                      {p.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setStatus.mutate({ id: p.id, status: "rejected" })}
                          disabled={setStatus.isPending}
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Reject
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
                  </div>
                </div>
              ))}
            </div>
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
