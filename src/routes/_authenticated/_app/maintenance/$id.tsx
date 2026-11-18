import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { BLOCK_TYPES } from "@/lib/rooms";
import {
  AssignTicketDialog, BlockTicketRoomDialog, PRIORITY, StatusBadge, TextReasonDialog, TICKET_STATUS,
  useTicket, useTicketBlocks, useWorkMutation,
} from "@/lib/maintenance";
import { TicketPhotos } from "@/components/ticket-photos";
import { StepBar } from "@/components/maintenance-parts";
import { COMMON_FIXES } from "@/lib/maintenance-view";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
      <dd className="col-span-2 min-w-0 [overflow-wrap:anywhere]">{children || "—"}</dd>
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

  // One main button for the next step; every other action sits under More. Who may do what is unchanged.
  type Act = { key: string; label: string; run: () => void; busy?: boolean; danger?: boolean };
  const acts: Act[] = [];
  const startAct: Act = { key: "s", label: t.status === "waiting" ? "Resume work" : "Start work", busy: start.isPending, run: () => start.mutate({ p_id: t.id }) };
  const resolveAct: Act = { key: "r", label: "Mark resolved", run: () => setDlg("resolve") };
  const closeAct: Act = { key: "c", label: "Check and close", busy: close.isPending, run: () => close.mutate({ p_id: t.id }) };
  if (worker && ["open", "assigned", "waiting"].includes(t.status)) acts.push(startAct);
  if (worker && ["assigned", "in_progress", "waiting"].includes(t.status)) acts.push(resolveAct);
  if (worker && ["assigned", "in_progress"].includes(t.status)) acts.push({ key: "w", label: "Put on hold", run: () => setDlg("wait") });
  if (can("mnt.ticket.close") && t.status === "resolved") acts.push(closeAct);
  if (can("mnt.ticket.close") && ["resolved", "closed"].includes(t.status)) acts.push({ key: "o", label: "Reopen", run: () => setDlg("reopen") });
  if (can("mnt.ticket.assign") && live) acts.push({ key: "a", label: t.assignee_id ? "Reassign" : "Assign", run: () => setDlg("assign") });
  if (can("room.ooo.set") && t.room_id && !["closed", "cancelled"].includes(t.status)) acts.push({ key: "b", label: "Block room", run: () => setDlg("block") });
  if (live && (can("mnt.ticket.assign") || (t.created_by === ctx.user_id && t.status === "open"))) acts.push({ key: "x", label: "Cancel ticket", danger: true, run: () => setDlg("cancel") });
  const mainKey = ["s", "r", "c", "a"].find((k) => acts.some((a) => a.key === k) && !(k === "a" && (t.assignee_id || t.status !== "open")));
  const main = acts.find((a) => a.key === mainKey);
  const more = acts.filter((a) => a !== main);
  const actions = (
    <div className="flex flex-wrap gap-2">
      {main && <Button disabled={main.busy === true} onClick={main.run}>{main.label}</Button>}
      {more.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline">More <ChevronDown className="h-4 w-4" aria-hidden /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {more.map((a) => <DropdownMenuItem key={a.key} className={a.danger ? "h-11 text-destructive" : "h-11"} disabled={a.busy === true} onClick={a.run}>{a.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <div>
      <Link to="/maintenance" className="mb-3 inline-flex h-11 items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All tickets</Link>
      <PageHeader title={t.title} description={t.room_number ? `${t.room_number}${t.location ? ` · ${t.location}` : ""}` : t.location ?? ""}
        actions={actions} />
      <StepBar status={t.status} />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge map={TICKET_STATUS} value={t.status} />
        <StatusBadge map={PRIORITY} value={t.priority} />
        {t.has_approved_block ? <Badge variant="danger">Room blocked</Badge> : t.has_active_block ? <Badge variant="warning">Block requested</Badge> : null}
        {t.reopen_count > 0 && <Badge variant="warning">Reopened {t.reopen_count}×</Badge>}
      </div>
      {t.status === "resolved" && t.resolved_by === ctx.user_id && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-warning-strong">You resolved this ticket, so a different person must check and close it.</p>
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
        <TicketPhotos ticketId={t.id} canAdd={!(["closed", "cancelled"].includes(t.status)) && (can("mnt.ticket.create") || can("mnt.ticket.work") || t.assignee_id === ctx.user_id || t.created_by === ctx.user_id)} canRemoveAny={can("mnt.ticket.assign")} />
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
              <Link to="/rooms/$id" params={{ id: t.room_id }} className="mt-3 inline-flex h-11 items-center text-primary-strong hover:underline">Open {t.room_number} to release blocks</Link>
            </CardContent>
          </Card>
        )}
      </div>

      <AssignTicketDialog ticket={dlg === "assign" ? t : null} onOpenChange={(o) => !o && done()} />
      <BlockTicketRoomDialog ticket={dlg === "block" ? t : null} onOpenChange={(o) => !o && done()} />
      <TextReasonDialog open={dlg === "wait"} title="Put on hold" label="What are you waiting for?" busy={wait.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => wait.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "resolve"} title="Mark resolved" label="What was done?" quick={COMMON_FIXES} busy={resolve.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => resolve.mutate({ p_id: t.id, p_resolution: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "reopen"} title="Reopen ticket" label="Why is it being reopened?" busy={reopen.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => reopen.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
      <TextReasonDialog open={dlg === "cancel"} title="Cancel ticket" label="Reason" busy={cancel.isPending}
        onOpenChange={(o) => !o && done()} onSubmit={(r) => cancel.mutate({ p_id: t.id, p_reason: r }, { onSuccess: done })} />
    </div>
  );
}
