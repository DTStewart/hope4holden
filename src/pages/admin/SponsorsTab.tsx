import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Save, Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

function TiersCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editSlots, setEditSlots] = useState<Record<string, string>>({});

  const { data: tiers, isLoading } = useQuery({
    queryKey: ["admin-tiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsorship_tiers")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: sponsors } = useQuery({
    queryKey: ["admin-sponsors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sponsors").select("tier_id, approved");
      if (error) throw error;
      return data;
    },
  });

  const countForTier = (tierId: string) =>
    sponsors?.filter((s) => s.tier_id === tierId && s.approved).length ?? 0;

  const updateSlots = useMutation({
    mutationFn: async ({ id, max_slots }: { id: string; max_slots: number | null }) => {
      const { error } = await supabase
        .from("sponsorship_tiers")
        .update({ max_slots } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tiers"] });
      toast({ title: "Tier updated" });
    },
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsorship Tier Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Max Slots</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers?.map((tier) => {
              const filled = countForTier(tier.id);
              const maxSlots = (tier as any).max_slots as number | null;
              const editVal = editSlots[tier.id];
              const currentVal = editVal ?? (maxSlots != null ? String(maxSlots) : "");

              return (
                <TableRow key={tier.id}>
                  <TableCell className="font-medium">{tier.name}</TableCell>
                  <TableCell>${tier.price}</TableCell>
                  <TableCell>{filled}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unlimited"
                      className="w-24 h-8 text-sm"
                      value={currentVal}
                      onChange={(e) =>
                        setEditSlots((prev) => ({ ...prev, [tier.id]: e.target.value }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {maxSlots != null ? (
                      <Badge variant={filled >= maxSlots ? "destructive" : "default"}>
                        {filled}/{maxSlots} filled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Unlimited</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const val = currentVal === "" ? null : parseInt(currentVal);
                        updateSlots.mutate({ id: tier.id, max_slots: val });
                      }}
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground mt-3">
          Leave max slots empty for unlimited availability. Set to a number to limit (e.g., 1 for exclusive tiers).
        </p>
      </CardContent>
    </Card>
  );
}

export default function SponsorsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sponsors, isLoading } = useQuery({
    queryKey: ["admin-sponsors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("sponsors").update({ approved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      toast({ title: "Sponsor updated" });
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <TiersCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sponsors ({sponsors?.length ?? 0})</span>
            {sponsors && sponsors.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportToCsv("sponsors.csv",
                    ["Business", "Contact", "Email", "Phone", "Tier", "Amount", "Paid", "Approved", "Date"],
                    sponsors.map((s) => [
                      s.business_name, s.contact_name, s.contact_email, s.contact_phone || "",
                      s.tier_name, String(s.amount), s.paid ? "Yes" : "No", s.approved ? "Yes" : "No",
                      new Date(s.created_at).toLocaleDateString(),
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
          {sponsors?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No sponsors yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logo</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors?.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.logo_url ? (
                          <img src={s.logo_url} alt={s.business_name} className="h-10 w-10 object-contain rounded border" />
                        ) : (
                          <div className="h-10 w-10 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">—</div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{s.business_name}</TableCell>
                      <TableCell>{s.contact_name}</TableCell>
                      <TableCell>{s.contact_email}</TableCell>
                      <TableCell>{s.tier_name}</TableCell>
                      <TableCell>${s.amount}</TableCell>
                      <TableCell>
                        <Badge variant={s.paid ? "default" : "destructive"}>
                          {s.paid ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.approved ? "default" : "secondary"}>
                          {s.approved ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={s.approved ? "destructive" : "default"}
                          onClick={() => toggleApproval.mutate({ id: s.id, approved: !s.approved })}
                        >
                          {s.approved ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                        </Button>
                      </TableCell>
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
