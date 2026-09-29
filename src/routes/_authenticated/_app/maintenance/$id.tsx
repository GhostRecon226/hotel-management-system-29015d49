import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { BLOCK_TYPES } from "@/lib/rooms";
import {
  AssignTicketDialog, BlockTicketRoomDialog, PRIORITY, StatusBadge, TextReasonDialog, TICKET_STATUS,
  useTicket, useTicketBlocks, useWorkMutation,
} from "@/lib/maintenance";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/maintenance/$id")({ component: TicketDetail });

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-3 text-[15px] last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{children || "—"}</dd>
    </div>
  );
}

type Dlg = null | "assign" | "wait" | "resolve" | "reopen" | "cancel" | "block";
const BLOCK_STATUS: Record<string, { label: string; tone: "warning" | "danger" | "neutral" }> = {
  pending: { label: "Waiting for approval", tone: "warning" }, approved: { label: "Blocked", tone: "danger" },
  rejected: { label: "Rejected", tone: "neutral" }, released: { label: "Released", tone: "neutral" }, cancelled: { label: "Cancelled", tone: "neutral" },
};

function TicketDetail() {
  const { id } = Route.useParams();
  const { can, ctx } = useAccess();
  const { data: t, isLoading } = useTicket(id);
  const blocks = useTicketBlocks(id);
  const [dlg, setDlg] = useState<Dlg>(null);
  const start = useWorkMutation("start_ticket", "Work started.");
  const wait = useWorkMutation("wait_ticket", "Ticket on hold.");
  const resolve = useWorkMutation("resolve_ticket", "Ticket resolved. Someone else must now check and close it.");
  const close = useWorkMutation("close_ticket", "Ticket closed.");
  const reopen = useWorkMutation("reopen_ticket", "Ticket reopened.");
  const cancel = useWorkMutation("cancel_ticket", "Ticket cancelled.");

  if (isLoading) return <LoadingState label="Loading ticket…" />;
  if (!t) return <EmptyState title="Ticket not found" description="It may belong to another property." />;

  const mineOrLead = t.assignee_id === ctx.user_id || can("mnt.ticket.assign");
  const worker = can("mnt.ticket.work") && mineOrLead;
  const live = ["open", "assigned", "in_progress", "waiting"].includes(t.status);
  const done = () => setDlg(null);

  const actions: ReactNode[] = [];
  if (worker && ["open", "assigned", "waiting"].includes(t.status)) actions.push(<Button key="s" disabled={start.isPending} onClick={() => start.mutate({ p_id: t.id })}>{t.status === "waiting" ? "Resume work" : "Start work"}</Button>);
  if (worker && ["assigned", "in_progress", "waiting"].includes(t.status)) actions.push(<Button key="r" onClick={() => setDlg("resolve")}>Mark resolved</Button>);
  if (worker && ["assigned", "in_progress"].includes(t.status)) actions.push(<Button key="w" variant="outline" onClick={() => setDlg("wait")}>Put on hold</Button>);
  if (can("mnt.ticket.close") && t.status === "resolved") actions.push(<Button key="c" disabled={close.isPending} onClick={() => close.mutate({ p_id: t.id })}>Check and close</Button>);
  if (can("mnt.ticket.close") && ["resolved", "closed"].includes(t.status)) actions.push(<Button key="o" variant="outline" onClick={() => setDlg("reopen")}>Reopen</Button>);
  if (can("mnt.ticket.assign") && live) actions.push(<Button key="a" variant="outline" onClick={() => setDlg("assign")}>{t.assignee_id ? "Reassign" : "Assign"}</Button>);
  if (can("room.ooo.set") && t.room_id && !["closed", "cancelled"].includes(t.status)) actions.push(<Button key="b" variant="outline" onClick={() => setDlg("block")}>Block room</Button>);
  if (live && (can("mnt.ticket.assign") || (t.created_by === ctx.user_id && t.status === "open"))) actions.push(<Button key="x" variant="ghost" className="text-destructive" onClick={() => setDlg("cancel")}>Cancel ticket</Button>);

  return (
    <div>
      <Link to="/maintenance" className="mb-3 inline-flex h-11 items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All tickets</Link>
      <PageHeader title={t.title} description={t.room_number ? `Room ${t.room_number}${t.location ? ` · ${t.location}` : ""}` : t.location ?? ""}
        actions={<div className="flex flex-wrap gap-2">{actions}</div>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge map={TICKET_STATUS} value={t.status} />
        <StatusBadge map={PRIORITY} value={t.priority} />
        {t.has_active_block && <Badge variant="danger">Room blocked</Badge>}
        {t.reopen_count > 0 && <Badge variant="warning">Reopened {t.reopen_count}×</Badge>}
      </div>
      {t.status === "resolved" && t.resolved_by === ctx.user_id && (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-[15px]">You resolved this ticket, so a different person must check and close it.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <Row label="Details">{t.description}</Row>
              <Row label="Assigned to">{t.assignee_name}</Row>
              {t.wait_reason && <Row label="Waiting for">{t.wait_reason}</Row>}
              <Row label="Reported by">{t.created_by_name ? `${t.created_by_name} · ${formatDateTime(t.created_at)}` : formatDateTime(t.created_at)}</Row>
              {t.last_reopen_reason && <Row label="Reopened because">{t.last_reopen_reason}</Row>}
              {t.cancel_reason && <Row label="Cancelled because">{t.cancel_reason}</Row>}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Resolution</CardTitle></CardHeader>
          <CardContent>
            <dl>
              <Row label="What was done">{t.resolution}</Row>
              <Row label="Resolved by">{t.resolved_by_name && `${t.resolved_by_name} · ${formatDateTime(t.resolved_at)}`}</Row>
              <Row label="Closed by">{t.closed_by_name && `${t.closed_by_name} · ${formatDateTime(t.closed_at)}`}</Row>
            </dl>
          </CardContent>
        </Card>
        {t.room_id && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Room blocks from this ticket</CardTitle></CardHeader>
            <CardContent>
              {(blocks.data ?? []).length === 0
                ? <p className="text-muted-foreground">No blocks. Use Block room if the room cannot be sold while this is fixed.</p>
                : <ul className="divide-y">{(blocks.data ?? []).map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span>{BLOCK_TYPES[b.block_type] ?? b.block_type} · {formatDay(b.from_date)} – {formatDay(b.to_date)}</span>
                      <Badge variant={BLOCK_STATUS[b.status]?.tone ?? "neutral"}>{BLOCK_STATUS[b.status]?.label ?? b.status}</Badge>
                    </li>))}
                  </ul>}
              <Link to="/rooms/$id" params={{ id: t.room_id }} className="mt-3 inline-flex h-11 items-center text-primary-strong hover:underline">Open room {t.room_number} to release blocks</Link>
            </CardContent>
          </Card>
        )}
      </div>

      <AssignTicketDialog ticket={dlg === "assign" ? t : null} onOpenChange={(o) => !o && done()} />
      <BlockTicketRoomDialog ticket={dlg === "block" ? t : null} onOpenChange={(o) => !o && done()} />
      <TextReasonDialog open={dlg === "wait"} title="Put on hold" label="What are you waiting for?" busy={wait.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => wait.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "resolve"} title="Mark resolved" label="What was done?" busy={resolve.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => resolve.mutate({ p_id: t.id, p_resolution: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "reopen"} title="Reopen ticket" label="Why is it being reopened?" busy={reopen.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => reopen.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "cancel"} title="Cancel ticket" label="Reason" busy={cancel.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => cancel.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
    </div>
  );
}
