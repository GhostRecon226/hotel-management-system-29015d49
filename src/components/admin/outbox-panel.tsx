import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { runOutboxNow } from "@/lib/outbox.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusVariant = { pending: "warning", sent: "success", failed: "danger" } as const;

export function OutboxPanel() {
  const qc = useQueryClient();
  const run = useServerFn(runOutboxNow);
  const status = useQuery({ queryKey: ["outbox", "status"], queryFn: () => callRpc<{ pending: number; sent: number; failed: number }>("outbox_status", {}) });
  const rows = useQuery({
    queryKey: ["outbox", "rows"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_outbox")
        .select("id, channel, recipient, subject, status, attempts, last_error, created_at, sent_at")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const mut = useMutation({
    mutationFn: () => run(),
    onSuccess: (r) => {
      toast.success(`Processed ${r.processed}: ${r.sent} sent, ${r.failed} not sent.`);
      if (!r.emailReady) toast.info("Email is not connected yet, so emails stay waiting.");
      qc.invalidateQueries({ queryKey: ["outbox"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle>Messages to guests and staff</CardTitle>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}><Send className="h-4 w-4" /> Run now</Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">Waiting {status.data?.pending ?? "—"}</Badge>
            <Badge variant="success">Sent {status.data?.sent ?? "—"}</Badge>
            <Badge variant="danger">Failed {status.data?.failed ?? "—"}</Badge>
          </div>
          <p>Booking confirmations and approval alerts are sent by email. Email is not connected yet, so messages wait here until it is. Text message and WhatsApp are not available yet.</p>
        </CardContent>
      </Card>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Created</TableHead><TableHead>Channel</TableHead><TableHead>To</TableHead><TableHead>Subject</TableHead>
          <TableHead>Status</TableHead><TableHead className="text-right">Tries</TableHead><TableHead>Last error</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.isLoading && <TableSkeletonRows cols={7} />}
          {!rows.isLoading && (rows.data ?? []).length === 0 && <TableStateRow colSpan={7} title="No messages yet" />}
          {(rows.data ?? []).map((m) => (
            <TableRow key={m.id}>
              <TableCell className="tabular">{formatDateTime(m.created_at)}</TableCell>
              <TableCell className="capitalize">{m.channel}</TableCell>
              <TableCell>{m.recipient}</TableCell>
              <TableCell>{m.subject ?? "—"}</TableCell>
              <TableCell><Badge variant={statusVariant[m.status as keyof typeof statusVariant] ?? "secondary"} className="capitalize">{m.status}</Badge></TableCell>
              <TableCell className="text-right tabular">{m.attempts}</TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={m.last_error ?? ""}>{m.last_error ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
