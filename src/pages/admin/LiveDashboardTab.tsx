import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Plus, Trash2, Loader2, Copy } from "lucide-react";

type Settings = {
  id: number;
  show_auction: boolean;
  show_leaderboard: boolean;
  show_rainbow: boolean;
  show_fundraising: boolean;
  refresh_interval_seconds: number;
};

type Winner = {
  id: string;
  prize_description: string;
  winner_name: string;
  amount: number | null;
  sort_order: number;
  created_at: string;
};

export default function LiveDashboardTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading: loadingSettings } = useQuery<Settings>({
    queryKey: ["admin-live-dashboard-settings"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("live_dashboard_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as Settings;
    },
  });

  const { data: winners, isLoading: loadingWinners } = useQuery<Winner[]>({
    queryKey: ["admin-rainbow-winners"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("rainbow_auction_winners")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Winner[];
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await adminSupabase
        .from("live_dashboard_settings")
        .update(patch)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-live-dashboard-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const [newPrize, setNewPrize] = useState("");
  const [newWinner, setNewWinner] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addWinner = useMutation({
    mutationFn: async () => {
      if (!newPrize.trim() || !newWinner.trim()) {
        throw new Error("Prize and winner name are required");
      }
      const maxSort = winners?.reduce((m, w) => Math.max(m, w.sort_order), 0) ?? 0;
      const { error } = await adminSupabase.from("rainbow_auction_winners").insert({
        prize_description: newPrize.trim(),
        winner_name: newWinner.trim(),
        amount: newAmount ? Math.round(Number(newAmount)) : null,
        sort_order: maxSort + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPrize("");
      setNewWinner("");
      setNewAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-rainbow-winners"] });
      toast({ title: "Winner added" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const deleteWinner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await adminSupabase.from("rainbow_auction_winners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rainbow-winners"] });
      toast({ title: "Winner removed" });
    },
  });

  const liveUrl = typeof window !== "undefined" ? `${window.location.origin}/live` : "/live";

  const copyUrl = () => {
    void navigator.clipboard.writeText(liveUrl);
    toast({ title: "Copied", description: liveUrl });
  };

  if (loadingSettings || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projector URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste into Canva's embed block or PowerPoint's Insert → Web Page. Also projectable
            full-screen from any browser. No login required.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">
              {liveUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUrl}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href="/live" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Section visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            id="show_fundraising"
            label="Total raised strip"
            hint="Big headline dollar number + teams/sponsors/donations breakdown."
            checked={settings.show_fundraising}
            onChange={(v) => updateSettings.mutate({ show_fundraising: v })}
          />
          <ToggleRow
            id="show_auction"
            label="Top auction bids"
            hint="Top 5 items by current high bid."
            checked={settings.show_auction}
            onChange={(v) => updateSettings.mutate({ show_auction: v })}
          />
          <ToggleRow
            id="show_leaderboard"
            label="Friday leaderboard"
            hint="Top 10 verified scorecard submissions."
            checked={settings.show_leaderboard}
            onChange={(v) => updateSettings.mutate({ show_leaderboard: v })}
          />
          <ToggleRow
            id="show_rainbow"
            label="Rainbow auction winners"
            hint="The list you enter below during Thursday dinner."
            checked={settings.show_rainbow}
            onChange={(v) => updateSettings.mutate({ show_rainbow: v })}
          />

          <div className="pt-2 flex items-end gap-3 max-w-sm">
            <div className="flex-1 space-y-1">
              <Label htmlFor="refresh-interval">Refresh interval (seconds)</Label>
              <Input
                id="refresh-interval"
                type="number"
                min={5}
                max={600}
                defaultValue={settings.refresh_interval_seconds}
                onBlur={(e) => {
                  const v = Math.max(5, Math.min(600, Number(e.target.value) || 30));
                  if (v !== settings.refresh_interval_seconds) {
                    updateSettings.mutate({ refresh_interval_seconds: v });
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground pb-2">Realtime pushes update instantly; this is the fallback poll.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rainbow auction winners</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
            <div className="space-y-1">
              <Label htmlFor="prize">Prize</Label>
              <Input
                id="prize"
                value={newPrize}
                onChange={(e) => setNewPrize(e.target.value)}
                placeholder="Spa package"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="winner">Winner</Label>
              <Input
                id="winner"
                value={newWinner}
                onChange={(e) => setNewWinner(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="amount">Amount (optional)</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <Button
              onClick={() => addWinner.mutate()}
              disabled={addWinner.isPending || !newPrize.trim() || !newWinner.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {loadingWinners ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !winners?.length ? (
            <p className="text-sm text-muted-foreground py-4">
              None yet. Add as you announce them on stage.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prize</TableHead>
                  <TableHead>Winner</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {winners.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.prize_description}</TableCell>
                    <TableCell>{w.winner_name}</TableCell>
                    <TableCell className="text-right">
                      {w.amount != null ? `$${w.amount.toLocaleString("en-CA")}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteWinner.mutate(w.id)}
                        aria-label="Remove"
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

function ToggleRow({
  id, label, hint, checked, onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label htmlFor={id} className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
