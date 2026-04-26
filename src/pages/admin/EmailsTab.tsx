import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { adminSupabase } from "@/integrations/supabase/adminClient";
import { ensureAdminSession } from "@/lib/ensureSession";
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
import { Mail, CheckCircle, XCircle, AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminDataTable } from "@/components/admin/AdminDataTable";

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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

interface EmailRow {
  id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  metadata: any;
  created_at: string;
}

export default function EmailsTab() {
  const [timeRange, setTimeRange] = useState(168);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleResend = async (row: EmailRow) => {
    setResendingId(row.id);
    try {
      const templateData =
        (row.metadata && typeof row.metadata === "object" && (row.metadata as any).templateData) || {};
      const { error } = await adminSupabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: row.template_name,
          recipientEmail: row.recipient_email,
          idempotencyKey: `manual-resend-${row.id}-${Date.now()}`,
          templateData,
        },
      });
      if (error) throw error;
      toast({ title: "Email resent", description: `${row.template_name} → ${row.recipient_email}` });
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ["admin-emails"],
    queryFn: async () => {
      await ensureAdminSession();
      const { data, error } = await adminSupabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailRow[];
    },
  });

  // Deduplicate by message_id — keep latest row per message_id
  const logs = useMemo(() => {
    if (!rawLogs) return [];
    const seen = new Map<string, EmailRow>();
    for (const row of rawLogs) {
      const key = row.message_id ?? row.id;
      if (!seen.has(key)) seen.set(key, row);
    }
    return Array.from(seen.values());
  }, [rawLogs]);

  const templateNames = useMemo(() => {
    const names = new Set(logs.map((l) => l.template_name));
    return Array.from(names).sort();
  }, [logs]);

  // Apply non-search filters above AdminDataTable
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

  const stats = useMemo(() => {
    const s = { total: filtered.length, sent: 0, failed: 0, suppressed: 0 };
    for (const l of filtered) {
      if (l.status === "sent") s.sent++;
      else if (l.status === "dlq" || l.status === "failed") s.failed++;
      else if (l.status === "suppressed") s.suppressed++;
    }
    return s;
  }, [filtered]);

  const columns = useMemo<ColumnDef<EmailRow>[]>(() => [
    {
      accessorKey: "template_name",
      header: "Template",
      cell: ({ row }) => <span className="font-medium text-xs">{row.original.template_name}</span>,
    },
    {
      accessorKey: "recipient_email",
      header: "Recipient",
      cell: ({ row }) => <span className="text-xs">{row.original.recipient_email}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={STATUS_COLORS[row.original.status] ?? "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">
          {new Date(row.original.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "error_message",
      header: "Error",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-destructive max-w-xs truncate block" title={row.original.error_message || ""}>
          {row.original.error_message || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const l = row.original;
        const canResend = l.status === "pending" || l.status === "failed" || l.status === "dlq";
        if (!canResend) return null;
        return (
          <Button
            size="sm"
            variant="outline"
            title="Resend this email"
            disabled={resendingId === l.id}
            onClick={() => handleResend(l)}
          >
            {resendingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
          </Button>
        );
      },
    },
  ], [resendingId]);

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

      {/* Filters (preserved as separate controls above AdminDataTable) */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1 flex-wrap">
              {TIME_RANGES.map((r) => (
                <Button
                  key={r.hours}
                  size="sm"
                  variant={timeRange === r.hours ? "default" : "outline"}
                  onClick={() => setTimeRange(r.hours)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
          <AdminDataTable<EmailRow>
            data={filtered}
            columns={columns}
            urlStateKey="emails"
            searchPlaceholder="Search recipient, template, error…"
            searchKeys={["recipient_email", "template_name", "status", "error_message"]}
            initialSort={{ id: "created_at", desc: true }}
            emptyMessage="No emails found for the selected filters."
            exportFilename="emails"
          />
        </CardContent>
      </Card>
    </div>
  );
}
