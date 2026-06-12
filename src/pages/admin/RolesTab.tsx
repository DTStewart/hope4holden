import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Shield } from "lucide-react";

type AppRole = "admin" | "moderator" | "user";

type RoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

const formSchema = z.object({
  user_id: z.string().trim().uuid({ message: "Must be a valid UUID" }),
  role: z.enum(["admin", "moderator", "user"]),
});

export default function RolesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AppRole>("admin");
  const [submitting, setSubmitting] = useState(false);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RoleRow[];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = formSchema.safeParse({ user_id: userId, role });
    if (!parsed.success) {
      toast({
        title: "Invalid input",
        description: parsed.error.errors[0]?.message ?? "Check your inputs",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await ensureAdminSession();

      // If a row already exists for this user, update it instead of inserting.
      const { data: existing, error: lookupErr } = await adminSupabase
        .from("user_roles")
        .select("id, role")
        .eq("user_id", parsed.data.user_id)
        .maybeSingle();
      if (lookupErr) throw lookupErr;

      if (existing) {
        if (existing.role === parsed.data.role) {
          toast({
            title: "No change",
            description: `User already has the ${parsed.data.role} role.`,
          });
        } else {
          const { error } = await adminSupabase
            .from("user_roles")
            .update({ role: parsed.data.role })
            .eq("id", existing.id);
          if (error) throw error;
          toast({
            title: "Role updated",
            description: `Changed ${existing.role} → ${parsed.data.role}.`,
          });
        }
      } else {
        const { error } = await adminSupabase.from("user_roles").insert({
          user_id: parsed.data.user_id,
          role: parsed.data.role,
        });
        if (error) throw error;
        toast({
          title: "Role assigned",
          description: `Granted ${parsed.data.role} to user.`,
        });
      }

      setUserId("");
      setRole("admin");
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (row: RoleRow) => {
    if (!confirm(`Remove ${row.role} role from this user?`)) return;
    try {
      await ensureAdminSession();
      const { error } = await adminSupabase
        .from("user_roles")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: "Role removed" });
      qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading">
            <Shield className="h-5 w-5" />
            Assign / Update Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="user-id">User ID (UUID)</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">admin</SelectItem>
                  <SelectItem value="moderator">moderator</SelectItem>
                  <SelectItem value="user">user</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Role"}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-3">
            If a role already exists for this user, it will be updated instead of duplicated.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Existing Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !roles || roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No roles assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.user_id}</TableCell>
                    <TableCell>{r.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(r)}
                        aria-label="Remove role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
