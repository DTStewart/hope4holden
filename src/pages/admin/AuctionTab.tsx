import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { supabase } from "@/integrations/supabase/client";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, X, Upload, Save, Gavel } from "lucide-react";
import AuctionWinnersCard from "./AuctionWinnersCard";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

type Item = {
  id: string;
  title: string;
  description: string | null;
  donated_by: string | null;
  images: Array<{ url: string; alt?: string }>;
  starting_bid: number;
  bid_increment: number | null;
  market_value: number;
  pickup_option: "thursday_dinner" | "friday_checkin" | "contact_winner" | "shippable";
  pickup_notes: string | null;
  status: "draft" | "open" | "closed";
  sort_order: number;
  ends_at: string | null;
};

type Settings = {
  id: number;
  is_live: boolean;
  bidding_opens_at: string | null;
  bidding_closes_at: string | null;
  anti_snipe_seconds: number;
  default_bid_increment: number;
  notes: string | null;
};

const PICKUP_OPTIONS = [
  { value: "thursday_dinner", label: "Thursday dinner pickup" },
  { value: "friday_checkin", label: "Friday check-in pickup" },
  { value: "contact_winner", label: "Contact winner to arrange" },
  { value: "shippable", label: "Shippable (buyer pays shipping)" },
];

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
function fromDatetimeLocal(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export default function AuctionTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings } = useQuery<Settings>({
    queryKey: ["admin-auction-settings"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("auction_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as Settings;
    },
  });

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["admin-auction-items"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await supabase
        .from("auction_items")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Item[];
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const { error } = await supabase
        .from("auction_settings")
        .update(updates)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-auction-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("auction_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-auction-items"] });
      toast({ title: "Item deleted" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Auction Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <SettingsForm
              settings={settings}
              onSave={(updates) => saveSettings.mutate(updates)}
              saving={saveSettings.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Items</CardTitle>
          <ItemDialog
            mode="create"
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-auction-items"] })}
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <AuctionItemsTable
              items={items || []}
              pickupOptions={PICKUP_OPTIONS}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["admin-auction-items"] })}
              onDelete={(id) => deleteItem.mutate(id)}
            />
          )}
        </CardContent>
      </Card>

      {/* Winners & settlement */}
      <AuctionWinnersCard />
    </div>
  );
}

function AuctionItemsTable({
  items,
  pickupOptions,
  onRefresh,
  onDelete,
}: {
  items: Item[];
  pickupOptions: { value: string; label: string }[];
  onRefresh: () => void;
  onDelete: (id: string) => void;
}) {
  const columns = useMemo<ColumnDef<Item>[]>(() => [
    {
      accessorKey: "title",
      header: "Item",
      cell: ({ row }) => {
        const it = row.original;
        return (
          <div className="flex items-center gap-3">
            {it.images?.[0]?.url ? (
              <img src={it.images[0].url} alt="" className="h-10 w-10 object-cover rounded" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted" />
            )}
            <div>
              <div className="font-medium">{it.title}</div>
              {it.description && (
                <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                  {it.description}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "donated_by",
      header: "Donor",
      cell: ({ row }) => <span className="text-sm">{row.original.donated_by || "—"}</span>,
    },
    {
      accessorKey: "starting_bid",
      header: "Start",
      cell: ({ row }) => `$${row.original.starting_bid.toLocaleString()}`,
    },
    {
      accessorKey: "market_value",
      header: "Retail",
      cell: ({ row }) => `$${row.original.market_value.toLocaleString()}`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "open" ? "default" : row.original.status === "closed" ? "secondary" : "outline"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "pickup_option",
      header: "Pickup",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {pickupOptions.find((p) => p.value === row.original.pickup_option)?.label || row.original.pickup_option}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => {
        const it = row.original;
        return (
          <div className="flex gap-2 justify-end">
            <ItemDialog mode="edit" item={it} onSaved={onRefresh} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes {it.title} from the auction permanently.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(it.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      },
    },
  ], [pickupOptions, onRefresh, onDelete]);

  return (
    <AdminDataTable<Item>
      data={items}
      columns={columns}
      urlStateKey="auction_items"
      searchPlaceholder="Search title, donor, status…"
      searchKeys={["title", "description", "donated_by", "status"]}
      initialSort={{ id: "sort_order" as any, desc: false }}
      emptyMessage='No items yet. Click "Add item" to create your first one.'
      exportFilename="auction-items"
    />
  );
}

function SettingsForm({
  settings,
  onSave,
  saving,
}: {
  settings: Settings;
  onSave: (updates: Partial<Settings>) => void;
  saving: boolean;
}) {
  const [isLive, setIsLive] = useState(settings.is_live);
  const [opensAt, setOpensAt] = useState(toDatetimeLocal(settings.bidding_opens_at));
  const [closesAt, setClosesAt] = useState(toDatetimeLocal(settings.bidding_closes_at));
  const [antiSnipe, setAntiSnipe] = useState(settings.anti_snipe_seconds);
  const [defaultIncrement, setDefaultIncrement] = useState(settings.default_bid_increment);
  const [notes, setNotes] = useState(settings.notes || "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch checked={isLive} onCheckedChange={setIsLive} id="is_live" />
        <Label htmlFor="is_live" className="cursor-pointer">
          Auction is live <span className="text-muted-foreground font-normal">(toggles /auction from placeholder to item grid)</span>
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="opens">Bidding opens at</Label>
          <Input
            id="opens"
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="closes">Bidding closes at</Label>
          <Input
            id="closes"
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incr">Default bid increment ($)</Label>
          <Input
            id="incr"
            type="number"
            min={1}
            value={defaultIncrement}
            onChange={(e) => setDefaultIncrement(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="snipe">Anti-snipe seconds</Label>
          <Input
            id="snipe"
            type="number"
            min={0}
            value={antiSnipe}
            onChange={(e) => setAntiSnipe(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Bids within this many seconds of close extend the item's end time by the same amount.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Internal notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Anything the team needs to remember about this year's auction"
        />
      </div>

      <Button
        disabled={saving}
        onClick={() =>
          onSave({
            is_live: isLive,
            bidding_opens_at: fromDatetimeLocal(opensAt),
            bidding_closes_at: fromDatetimeLocal(closesAt),
            anti_snipe_seconds: antiSnipe,
            default_bid_increment: defaultIncrement,
            notes: notes || null,
          })
        }
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save settings
      </Button>
    </div>
  );
}

function ItemDialog({
  mode,
  item,
  onSaved,
}: {
  mode: "create" | "edit";
  item?: Item;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [donatedBy, setDonatedBy] = useState(item?.donated_by || "");
  const [startingBid, setStartingBid] = useState(item?.starting_bid ?? 25);
  const [bidIncrement, setBidIncrement] = useState<number | "">(item?.bid_increment ?? "");
  const [marketValue, setMarketValue] = useState(item?.market_value ?? 0);
  const [pickupOption, setPickupOption] = useState(item?.pickup_option || "thursday_dinner");
  const [pickupNotes, setPickupNotes] = useState(item?.pickup_notes || "");
  const [status, setStatus] = useState(item?.status || "draft");
  const [sortOrder, setSortOrder] = useState(item?.sort_order ?? 0);
  const [images, setImages] = useState<Array<{ url: string; alt?: string }>>(item?.images || []);

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Array<{ url: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("auction-items")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("auction-items").getPublicUrl(path);
        uploaded.push({ url: data.publicUrl });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        donated_by: donatedBy.trim() || null,
        images,
        starting_bid: Number(startingBid) || 0,
        bid_increment: bidIncrement === "" ? null : Number(bidIncrement),
        market_value: Number(marketValue) || 0,
        pickup_option: pickupOption,
        pickup_notes: pickupNotes.trim() || null,
        status,
        sort_order: Number(sortOrder) || 0,
      };
      if (mode === "edit" && item) {
        const { error } = await supabase.from("auction_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("auction_items").insert(payload);
        if (error) throw error;
      }
      toast({ title: mode === "edit" ? "Item updated" : "Item created" });
      onSaved();
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add item</Button>
        ) : (
          <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit item" : "New auction item"}</DialogTitle>
          <DialogDescription>
            Drafts aren't visible to bidders. Set status to &ldquo;open&rdquo; when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="donor">Donated by</Label>
            <Input
              id="donor"
              value={donatedBy}
              onChange={(e) => setDonatedBy(e.target.value)}
              placeholder="Pendleton Insurance"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Starting bid ($)</Label>
              <Input
                id="start"
                type="number"
                min={0}
                value={startingBid}
                onChange={(e) => setStartingBid(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mv">Retail value ($)</Label>
              <Input
                id="mv"
                type="number"
                min={0}
                value={marketValue}
                onChange={(e) => setMarketValue(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bi">Bid increment ($)</Label>
              <Input
                id="bi"
                type="number"
                min={1}
                value={bidIncrement}
                onChange={(e) => setBidIncrement(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="Uses default"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup option</Label>
              <Select value={pickupOption} onValueChange={(v) => setPickupOption(v as any)}>
                <SelectTrigger id="pickup"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PICKUP_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft (hidden)</SelectItem>
                  <SelectItem value="open">Open (visible + biddable)</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pnotes">Pickup notes (shown to winner)</Label>
            <Textarea
              id="pnotes"
              value={pickupNotes}
              onChange={(e) => setPickupNotes(e.target.value)}
              rows={2}
              placeholder="e.g., Pick up from Jill at the dinner, table 3."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="order">Sort order</Label>
            <Input
              id="order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label>Images</Label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img.url} alt="" className="h-24 w-24 object-cover rounded border" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full h-6 w-6 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-24 w-24 border-2 border-dashed rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
