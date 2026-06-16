import { useEffect, useState } from "react";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ChannelRow {
  id: string;
  channel: string;
  enabled: boolean;
  disabled_message: string | null;
}

const CHANNEL_LABELS: Record<string, { title: string; desc: string }> = {
  registration: { title: "Team Registration", desc: "$600 team checkout on Participate page." },
  dinner: { title: "Dinner Tickets", desc: "Dinner-only ticket purchases." },
  donation: { title: "Donations", desc: "One-off donation form on Participate page." },
  sponsorship: { title: "Sponsorships", desc: "All sponsorship tier purchases." },
  auction: { title: "Auction", desc: "Silent auction bidding & payments." },
};

export default function SalesChannelsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  // Per-row local edits keyed by channel id.
  const [edits, setEdits] = useState<Record<string, { enabled: boolean; disabled_message: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminSupabase
      .from("sales_channels")
      .select("id, channel, enabled, disabled_message")
      .order("channel");
    if (error) {
      toast({ title: "Failed to load sales channels", description: error.message, variant: "destructive" });
    } else if (data) {
      setRows(data);
      const e: Record<string, { enabled: boolean; disabled_message: string }> = {};
      for (const r of data) {
        e[r.id] = { enabled: r.enabled, disabled_message: r.disabled_message ?? "" };
      }
      setEdits(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (row: ChannelRow) => {
    const edit = edits[row.id];
    setSavingId(row.id);
    const { data: userRes } = await adminSupabase.auth.getUser();
    const { error } = await adminSupabase
      .from("sales_channels")
      .update({
        enabled: edit.enabled,
        disabled_message: edit.disabled_message.trim() === "" ? null : edit.disabled_message,
        updated_at: new Date().toISOString(),
        updated_by: userRes.user?.id ?? null,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${CHANNEL_LABELS[row.channel]?.title ?? row.channel} updated` });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading sales channels…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-heading font-bold">Sales Channels</h2>
        <p className="text-sm text-muted-foreground">
          Take a public sales section offline without a code change. Disabled channels are hidden from
          the Participate page and replaced with the message below (if set).
        </p>
      </div>

      <div className="grid gap-4">
        {rows.map((row) => {
          const meta = CHANNEL_LABELS[row.channel] ?? { title: row.channel, desc: "" };
          const edit = edits[row.id];
          const dirty =
            edit.enabled !== row.enabled ||
            (edit.disabled_message ?? "") !== (row.disabled_message ?? "");
          return (
            <Card key={row.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">{meta.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{meta.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`enabled-${row.id}`} className="text-sm">
                    {edit.enabled ? "Enabled" : "Disabled"}
                  </Label>
                  <Switch
                    id={`enabled-${row.id}`}
                    checked={edit.enabled}
                    onCheckedChange={(v) =>
                      setEdits((prev) => ({ ...prev, [row.id]: { ...prev[row.id], enabled: v } }))
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`msg-${row.id}`} className="text-sm">
                    Public message when disabled
                  </Label>
                  <Textarea
                    id={`msg-${row.id}`}
                    value={edit.disabled_message}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [row.id]: { ...prev[row.id], disabled_message: e.target.value },
                      }))
                    }
                    placeholder="Optional. Shown in place of the purchase UI when this channel is disabled."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => save(row)}
                    disabled={!dirty || savingId === row.id}
                    size="sm"
                  >
                    {savingId === row.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
