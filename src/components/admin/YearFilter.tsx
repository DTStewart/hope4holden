import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentTournamentYear, useDistinctTournamentYears } from "@/hooks/useTournamentYears";
import { useEffect } from "react";

interface YearFilterProps {
  table: "registrations" | "sponsors" | "donations" | "dinners" | "pending_orders";
  value: number | null;
  onChange: (year: number) => void;
}

export function YearFilter({ table, value, onChange }: YearFilterProps) {
  const { data: currentYear } = useCurrentTournamentYear();
  const { data: years } = useDistinctTournamentYears(table);

  // Default to current year once it loads
  useEffect(() => {
    if (value == null && currentYear != null) {
      onChange(currentYear);
    }
  }, [currentYear, value, onChange]);

  const options = Array.from(new Set([...(years || []), currentYear].filter((y): y is number => y != null))).sort((a, b) => b - a);
  const selected = value ?? currentYear ?? new Date().getFullYear();

  return (
    <Select value={String(selected)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-9 w-[110px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
