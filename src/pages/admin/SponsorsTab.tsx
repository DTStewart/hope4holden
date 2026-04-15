import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Save, Download, ImageIcon, Mail, Loader2, Trash2 } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

interface BrandAsset {
  url: string;
  filename: string;
  label?: string;
}

export default function SponsorsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [assetsDialog, setAssetsDialog] = useState<{ sponsor: any; assets: BrandAsset[] } | null>(null);
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);

  const handleResendUploadEmail = async (sponsor: any) => {
    if (!sponsor.logo_upload_token) {
      toast({ title: "No upload token", description: "This sponsor doesn't have an upload token. It may not have completed payment.", variant: "destructive" });
      return;
    }
    setSendingEmailFor(sponsor.id);
    try {
      const siteUrl = window.location.origin;
      const uploadUrl = `${siteUrl}/sponsor-upload/${sponsor.logo_upload_token}`;
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "sponsor-logo-upload",
          recipientEmail: sponsor.contact_email,
          idempotencyKey: `sponsor-upload-resend-${sponsor.id}-${Date.now()}`,
          templateData: {
            businessName: sponsor.business_name,
            tierName: sponsor.tier_name,
            uploadUrl,
          },
        },
      });
      if (error) throw error;
      toast({ title: "Email sent!", description: `Upload link sent to ${sponsor.contact_email}` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setSendingEmailFor(null);
    }
  };

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

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sponsors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      toast({ title: "Sponsor deleted" });
    },
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sponsors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      toast({ title: "All sponsors deleted" });
    },
  });

  const getAssets = (s: any): BrandAsset[] => {
    const assets = (s as any).brand_assets;
    return Array.isArray(assets) ? assets : [];
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <TiersCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sponsors ({sponsors?.length ?? 0})</span>
            <div className="flex gap-2">
              {sponsors && sponsors.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      exportToCsv("sponsors.csv",
                        ["Business", "Contact", "Email", "Phone", "Tier", "Amount", "Paid", "Approved", "Assets", "Date"],
                        sponsors.map((s) => [
                          s.business_name, s.contact_name, s.contact_email, s.contact_phone || "",
                          s.tier_name, String(s.amount), s.paid ? "Yes" : "No", s.approved ? "Yes" : "No",
                          String(getAssets(s).length),
                          new Date(s.created_at).toLocaleDateString(),
                        ])
                      )
                    }
                  >
                    <Download className="h-4 w-4 mr-1" /> Export CSV
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete All</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete all sponsors?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete all {sponsors.length} sponsor(s). This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAll.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete All</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
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
                    <TableHead>Business</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sponsors?.map((s) => {
                    const assets = getAssets(s);
                    return (
                      <TableRow key={s.id}>
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
                          {assets.length > 0 ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              onClick={() => setAssetsDialog({ sponsor: s, assets })}
                            >
                              <ImageIcon className="h-3 w-3" />
                              {assets.length}
                            </Button>
                          ) : s.logo_url ? (
                            <img src={s.logo_url} alt="Logo" className="h-8 w-8 object-contain rounded" />
                          ) : (
                            <span className="text-muted-foreground text-xs">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={s.approved ? "default" : "secondary"}>
                            {s.approved ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-1">
                          <Button
                            size="sm"
                            variant={s.approved ? "destructive" : "default"}
                            onClick={() => toggleApproval.mutate({ id: s.id, approved: !s.approved })}
                          >
                            {s.approved ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Resend upload email"
                            disabled={sendingEmailFor === s.id}
                            onClick={() => handleResendUploadEmail(s)}
                          >
                            {sendingEmailFor === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets preview dialog */}
      <Dialog open={!!assetsDialog} onOpenChange={() => setAssetsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{assetsDialog?.sponsor?.business_name} — Brand Assets</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            {assetsDialog?.assets.map((asset, i) => (
              <a key={i} href={asset.url} target="_blank" rel="noopener noreferrer" className="group block">
                <div className="border border-border rounded p-2 hover:border-primary transition-colors">
                  <img src={asset.url} alt={asset.label || asset.filename} className="w-full h-24 object-contain" />
                  <p className="text-xs text-muted-foreground mt-1 truncate text-center">
                    {asset.label || asset.filename}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
