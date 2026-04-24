import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Save, ImageIcon, Mail, MailCheck, Loader2, Trash2, LinkIcon, Copy } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditableEmail } from "@/components/admin/EditableEmail";
import { resendForSponsor } from "@/lib/resendOrderConfirmation";
import { YearFilter } from "@/components/admin/YearFilter";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

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
    staleTime: 30_000,
  });

  const { data: sponsors } = useQuery({
    queryKey: ["admin-sponsors-tier-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sponsors").select("tier_id, approved");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
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

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [selectedTierId, setSelectedTierId] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [expiryDays, setExpiryDays] = useState("14");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: tiers } = useQuery({
    queryKey: ["admin-tiers-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsorship_tiers")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const selectedTier = tiers?.find((t) => t.id === selectedTierId);

  const handleCreate = async () => {
    if (!selectedTier) return;
    setCreating(true);
    try {
      const amount = customAmount ? parseInt(customAmount) : selectedTier.price;
      const days = parseInt(expiryDays) || 14;
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      const { data, error } = await supabase
        .from("sponsor_invites")
        .insert({
          tier_id: selectedTier.id,
          tier_name: selectedTier.name,
          amount,
          expires_at: expiresAt,
        } as any)
        .select("token")
        .single();

      if (error) throw error;
      const url = `https://hope4holden.com/sponsor-invite/${data.token}`;
      setGeneratedUrl(url);
      toast({ title: "Invite link created!" });
    } catch (err: any) {
      toast({ title: "Failed to create invite", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    toast({ title: "Copied to clipboard!" });
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setSelectedTierId("");
      setCustomAmount("");
      setExpiryDays("14");
      setGeneratedUrl("");
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Sponsor Invite Link</DialogTitle>
        </DialogHeader>
        {generatedUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share this link with your sponsor:</p>
            <div className="flex gap-2">
              <Input readOnly value={generatedUrl} className="text-xs" />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" variant="outline" onClick={() => setGeneratedUrl("")}>
              Create Another
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-tier">Tier *</Label>
              <select
                id="invite-tier"
                value={selectedTierId}
                onChange={(e) => setSelectedTierId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a tier</option>
                {tiers?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — ${t.price}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Custom Amount (optional)</Label>
              <Input
                type="number"
                min="1"
                placeholder={selectedTier ? `Default: $${selectedTier.price}` : "Select tier first"}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry (days)</Label>
              <Input type="number" min="1" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
            </div>
            <Button className="w-full" disabled={!selectedTierId || creating} onClick={handleCreate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
              Generate Invite Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SponsorsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [assetsDialog, setAssetsDialog] = useState<{ sponsor: any; assets: BrandAsset[] } | null>(null);
  const [sendingEmailFor, setSendingEmailFor] = useState<string | null>(null);
  const [resendingOrderFor, setResendingOrderFor] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const handleCopyUploadLink = async (sponsor: any) => {
    setGeneratingLinkFor(sponsor.id);
    try {
      let token = sponsor.logo_upload_token;
      if (!token) {
        token = crypto.randomUUID();
        const { error } = await supabase
          .from("sponsors")
          .update({ logo_upload_token: token })
          .eq("id", sponsor.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["admin-sponsors"] });
      }
      const url = `https://hope4holden.com/sponsor-upload/${token}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Upload link copied!", description: url });
    } catch (err: any) {
      toast({ title: "Failed to generate link", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setGeneratingLinkFor(null);
    }
  };

  const handleResendOrder = async (sponsor: any) => {
    setResendingOrderFor(sponsor.id);
    try {
      await resendForSponsor(sponsor);
      toast({ title: "Confirmation email sent", description: `Sent to ${sponsor.contact_email}` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingOrderFor(null);
    }
  };

  const handleResendUploadEmail = async (sponsor: any) => {
    if (!sponsor.logo_upload_token) {
      toast({ title: "No upload token", description: "This sponsor doesn't have an upload token. It may not have completed payment.", variant: "destructive" });
      return;
    }
    setSendingEmailFor(sponsor.id);
    try {
      const siteUrl = "https://hope4holden.com";
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

  useEffect(() => {
    console.log("[SponsorsTab] Mounted");
    return () => console.log("[SponsorsTab] Unmounted");
  }, []);

  const { data: sponsors, isLoading } = useQuery({
    queryKey: ["admin-sponsors", yearFilter],
    enabled: yearFilter != null,
    queryFn: async () => {
      console.log("[SponsorsTab] Fetching sponsors for year", yearFilter);
      const { data, error } = await supabase
        .from("sponsors")
        .select("id, business_name, contact_name, contact_email, contact_phone, facebook_handle, instagram_handle, tier_id, tier_name, amount, paid, approved, brand_assets, logo_url, logo_upload_token, stripe_session_id, created_at, updated_at")
        .eq("tournament_year", yearFilter as number)
        .order("created_at", { ascending: false });
      console.log("[SponsorsTab] sponsors query result:", { count: data?.length, error, firstRow: data?.[0] });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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

  const columns = useMemo<ColumnDef<any>[]>(() => [
    { accessorKey: "business_name", header: "Business", cell: ({ row }) => <span className="font-medium">{row.original.business_name}</span> },
    { accessorKey: "contact_name", header: "Contact" },
    {
      accessorKey: "contact_email",
      header: "Email",
      cell: ({ row }) => (
        <EditableEmail
          table="sponsors"
          id={row.original.id}
          column="contact_email"
          value={row.original.contact_email}
          invalidateKey={["admin-sponsors"]}
        />
      ),
    },
    {
      accessorKey: "facebook_handle",
      header: "Facebook",
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.facebook_handle || "—"}</span>,
    },
    {
      accessorKey: "instagram_handle",
      header: "Instagram",
      cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.instagram_handle || "—"}</span>,
    },
    { accessorKey: "tier_name", header: "Tier" },
    { accessorKey: "amount", header: "Amount", cell: ({ row }) => `$${row.original.amount}` },
    {
      accessorKey: "paid",
      header: "Paid",
      cell: ({ row }) => (
        <Badge variant={row.original.paid ? "default" : "destructive"}>
          {row.original.paid ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      id: "assets",
      header: "Assets",
      enableSorting: false,
      accessorFn: (s: any) => getAssets(s).length,
      cell: ({ row }) => {
        const s = row.original;
        const assets = getAssets(s);
        return assets.length > 0 ? (
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
        );
      },
    },
    {
      accessorKey: "approved",
      header: "Approved",
      cell: ({ row }) => (
        <Badge variant={row.original.approved ? "default" : "secondary"}>
          {row.original.approved ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="space-x-1 whitespace-nowrap">
            <Button
              size="sm"
              variant={s.approved ? "destructive" : "default"}
              onClick={() => toggleApproval.mutate({ id: s.id, approved: !s.approved })}
            >
              {s.approved ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </Button>
            {s.logo_upload_token && !s.logo_url && (
              <Button
                size="sm"
                variant="outline"
                title="Resend logo upload email"
                disabled={sendingEmailFor === s.id}
                onClick={() => handleResendUploadEmail(s)}
              >
                {sendingEmailFor === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              title="Copy upload link (for adding/replacing assets)"
              disabled={generatingLinkFor === s.id}
              onClick={() => handleCopyUploadLink(s)}
            >
              {generatingLinkFor === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LinkIcon className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              title="Resend order confirmation"
              disabled={resendingOrderFor === s.id}
              onClick={() => handleResendOrder(s)}
            >
              {resendingOrderFor === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MailCheck className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOne.mutate(s.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
  ], [sendingEmailFor, generatingLinkFor, resendingOrderFor, toggleApproval, deleteOne]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <TiersCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Sponsors ({sponsors?.length ?? 0})</span>
            <div className="flex gap-2 flex-wrap items-center">
              <YearFilter table="sponsors" value={yearFilter} onChange={setYearFilter} />
              <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                <LinkIcon className="h-4 w-4 mr-1" /> Generate Invite Link
              </Button>
              {sponsors && sponsors.length > 0 && (
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
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            data={sponsors ?? []}
            columns={columns}
            urlStateKey="sponsors"
            searchPlaceholder="Search business, contact, email…"
            searchKeys={["business_name", "contact_name", "contact_email", "contact_phone", "tier_name"]}
            initialSort={{ id: "created_at", desc: true }}
            emptyMessage="No sponsors yet."
            exportFilename="sponsors"
          />
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

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
