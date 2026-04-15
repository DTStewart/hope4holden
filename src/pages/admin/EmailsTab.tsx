import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  sent: "default",
  pending: "secondary",
  dlq: "destructive",
  failed: "destructive",
  suppressed: "outline",
  bounced: "destructive",
  complained: "destructive",
};

const TIME_RANGES = [
  { label: "Last 24h", hours: 24 },
  { label: "Last 7 days", hours: 168 },
  { label: "Last 30 days", hours: 720 },
  { label: "All time", hours: 0 },
];

const PAGE_SIZE = 50;

export default function EmailsTab() {
  const [timeRange, setTimeRange] = useState(168);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ["admin-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Deduplicate by message_id — keep latest row per message_id
  const logs = useMemo(() => {
    if (!rawLogs) return [];
    const seen = new Map<string, typeof rawLogs[0]>();
    for (const row of rawLogs) {
      const key = row.message_id ?? row.id;
      if (!seen.has(key)) {
        seen.set(key, row);
      }
    }
    return Array.from(seen.values());
  }, [rawLogs]);

  // Get distinct template names
  const templateNames = useMemo(() => {
    const names = new Set(logs.map((l) => l.template_name));
    return Array.from(names).sort();
  }, [logs]);

  // Filter
  const filtered = useMemo(() => {
    let result = logs;
    if (timeRange > 0) {
      const cutoff = new Date(Date.now() - timeRange * 60 * 60 * 1000).toISOString();
      result = result.filter((l) => l.created_at >= cutoff);
    }
    if (templateFilter !== "all") {
      result = result.filter((l) => l.template_name === templateFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }
    return result;
  }, [logs, timeRange, templateFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0 };
    for (const l of filtered) {
      if (l.status === "sent") s.sent++;
      else if (l.status === "dlq" || l.status === "failed") s.failed++;
      else if (l.status === "suppressed") s.suppressed++;
    }
    return s;
  }, [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  const handleFilterChange = (setter: (v: any) => void) => (val: any) => {
    setter(val);
    setPage(0);
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Emails</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.sent}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.suppressed}</p>
              <p className="text-xs text-muted-foreground">Suppressed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <Button
                  key={r.hours}
                  size="sm"
                  variant={timeRange === r.hours ? "default" : "outline"}
                  onClick={() => handleFilterChange(setTimeRange)(r.hours)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Select value={templateFilter} onValueChange={handleFilterChange(setTemplateFilter)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All templates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templateNames.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="dlq">Failed (DLQ)</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Email Log ({filtered.length} emails)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No emails found for the selected filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageData.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-xs">{l.template_name}</TableCell>
                        <TableCell className="text-xs">{l.recipient_email}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_COLORS[l.status] as any ?? "secondary"}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-xs truncate">
                          {l.error_message || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
