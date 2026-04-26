import { useQuery } from "@tanstack/react-query";
import { adminSupabase } from "@/integrations/supabase/adminClient";

/** Reads the current tournament year from public settings (no auth required). */
export function useCurrentTournamentYear() {
  return useQuery({
    queryKey: ["current-tournament-year"],
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("settings")
        .select("value")
        .eq("key", "current_tournament_year")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value as any;
      const parsed = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
    },
    staleTime: 60_000,
  });
}

/** Distinct years from a given table for populating filter dropdowns. */
export function useDistinctTournamentYears(table: "registrations" | "sponsors" | "donations" | "dinners" | "pending_orders") {
  return useQuery({
    queryKey: ["distinct-tournament-years", table],
    queryFn: async () => {
      const { data, error } = await (adminSupabase as any)
        .from(table)
        .select("tournament_year");
      if (error) throw error;
      const years = new Set<number>();
      (data || []).forEach((r: any) => {
        if (r.tournament_year != null) years.add(r.tournament_year);
      });
      return Array.from(years).sort((a, b) => b - a);
    },
    staleTime: 30_000,
  });
}
