import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "coming_soon", label: "Coming Soon" },
  { value: "open", label: "Open" },
  { value: "sold_out", label: "Sold Out" },
];

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  const getSetting = (key: string) => {
    const s = settings?.find((s) => s.key === key);
    return s ? s.value : null;
  };

  const getStringVal = (key: string) => {
    const v = getSetting(key);
    return v != null ? String(v) : "";
  };

  const regStatus = getStringVal("registration_status") || "coming_soon";

  const [spotsRemaining, setSpotsRemaining] = useState<string | null>(null);
  const displayedSpots = spotsRemaining ?? getStringVal("spots_remaining");

  const upsertSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const existing = settings?.find((s) => s.key === key);
      if (existing) {
        const { error } = await supabase
          .from("settings")
          .update({ value: value as any })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("settings")
          .insert({ key, value: value as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Setting saved" });
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tournament Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="reg-status" className="text-sm font-medium">Registration Status</Label>
            <Select
              value={regStatus}
              onValueChange={(val) =>
                upsertSetting.mutate({ key: "registration_status", value: val })
              }
            >
              <SelectTrigger id="reg-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {regStatus === "coming_soon" && "Registration page shows 'Coming Soon'"}
              {regStatus === "open" && "Registration form is visible and accepting teams"}
              {regStatus === "sold_out" && "Registration page shows 'Sold Out' with waitlist form"}
            </p>
          </div>

          <div className="flex items-end gap-4 max-w-sm">
            <div className="flex-1 space-y-2">
              <Label htmlFor="spots">Spots Remaining</Label>
              <Input
                id="spots"
                type="number"
                min="0"
                value={displayedSpots}
                onChange={(e) => setSpotsRemaining(e.target.value)}
              />
            </div>
            <Button
              onClick={() =>
                upsertSetting.mutate({
                  key: "spots_remaining",
                  value: Number(displayedSpots),
                })
              }
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {settings?.length === 0 ? (
            <p className="text-muted-foreground">No settings configured.</p>
          ) : (
            <div className="space-y-2">
              {settings?.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium text-sm">{s.key}</span>
                  <span className="text-muted-foreground text-sm">{JSON.stringify(s.value)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
