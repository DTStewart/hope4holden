import { useQuery } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
import { Card } from "@/components/ui/card";
import { DollarSign, Users, Handshake, Heart, UtensilsCrossed, Loader2, UserCheck } from "lucide-react";

const TEAM_PRICE = 600;

type Stats = {
  totalRaised: number;
  registrations: number;
  sponsors: number;
  donations: number;
  dinnerTickets: number;
  totalPlayers: number;
  totalDinnerTicketsYear: number;
};

export default function DashboardStats() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      await ensureAdminSession();

      const [regsRes, sponsorsRes, donationsRes, dinnersRes, headcountRes] = await Promise.all([
        adminSupabase.from("registrations").select("id, paid").eq("paid", true),
        adminSupabase.from("sponsors").select("id, amount, paid").eq("paid", true),
        adminSupabase.from("donations").select("id, amount, paid").eq("paid", true),
        adminSupabase.from("dinners").select("id, amount, quantity, paid").eq("paid", true),
        adminSupabase.rpc("get_player_headcount"),
      ]);

      if (regsRes.error) throw regsRes.error;
      if (sponsorsRes.error) throw sponsorsRes.error;
      if (donationsRes.error) throw donationsRes.error;
      if (dinnersRes.error) throw dinnersRes.error;
      if (headcountRes.error) throw headcountRes.error;

      const registrations = regsRes.data?.length ?? 0;
      const sponsorsAmount = (sponsorsRes.data ?? []).reduce((sum, s: any) => sum + (Number(s.amount) || 0), 0);
      const donationsAmount = (donationsRes.data ?? []).reduce((sum, d: any) => sum + (Number(d.amount) || 0), 0);
      const dinnersAmount = (dinnersRes.data ?? []).reduce((sum, d: any) => sum + (Number(d.amount) || 0), 0);

      const dinnerTickets = (dinnersRes.data ?? []).reduce((sum, d: any) => sum + (Number(d.quantity) || 1), 0);

      const hc: any = Array.isArray(headcountRes.data) ? headcountRes.data[0] : headcountRes.data;
      return {
        totalRaised: registrations * TEAM_PRICE + sponsorsAmount + donationsAmount + dinnersAmount,
        registrations,
        sponsors: sponsorsRes.data?.length ?? 0,
        donations: donationsRes.data?.length ?? 0,
        dinnerTickets,
        totalPlayers: Number(hc?.total_players ?? 0),
        totalDinnerTicketsYear: Number(hc?.total_dinner_tickets ?? 0),
      };
    },
    // Refresh on tab focus so numbers feel live without a manual reload
    refetchOnWindowFocus: true,
  });


  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading stats...
      </div>
    );
  }

  const items: { label: string; value: string; icon: any; highlight?: boolean }[] = [
    {
      label: "Total Raised",
      value: `$${data.totalRaised.toLocaleString("en-CA")}`,
      icon: DollarSign,
      highlight: true,
    },
    { label: "Teams", value: String(data.registrations), icon: Users },
    { label: "Sponsors", value: String(data.sponsors), icon: Handshake },
    { label: "Donations", value: String(data.donations), icon: Heart },
    { label: "Dinner Tickets", value: String(data.dinnerTickets), icon: UtensilsCrossed },
    { label: "Players (Year)", value: String(data.totalPlayers), icon: UserCheck },
    { label: "Dinner Tix (Year)", value: String(data.totalDinnerTicketsYear), icon: UtensilsCrossed },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className={`p-4 ${item.highlight ? "bg-primary/5 border-primary/30" : ""}`}
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
            <div
              className={`mt-1 font-heading font-extrabold ${
                item.highlight ? "text-2xl md:text-3xl text-primary" : "text-xl md:text-2xl text-foreground"
              }`}
            >
              {item.value}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
