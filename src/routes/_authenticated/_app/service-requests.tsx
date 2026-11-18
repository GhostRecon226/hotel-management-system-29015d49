import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import {
  AssignServiceDialog, StatusBadge, SVC_CATEGORIES, SVC_STATUS, TextReasonDialog, useServiceRequests, useWorkMutation,
  type ServiceRequest,
} from "@/lib/maintenance";
import { FilterBar, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RoomName } from "@/components/room-name";
import { ViewSwitch } from "@/components/maintenance-parts";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/service-requests")({
  head: () => ({
    meta: [
      { title: "Service requests — Zikora" },
      { name: "description", content: "Guest requests from in-house guests, with charges posted to the folio when done." },
      { property: "og:title", content: "Service requests — Zikora" },
      { property: "og:description", content: "Guest requests from in-house guests, with charges posted to the folio when done." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServiceRequests,
});

const ACTIVE = ["open", "assigned", "in_progress"];

function ServiceRequests() {
  const { can, ctx } = useAccess();
  const { data = [], isLoading } = useServiceRequests();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [assign, setAssign] = useState<ServiceRequest | null>(null);
  const [cancelling, setCancelling] = useState<ServiceRequest | null>(null);
  const start = useWorkMutation("start_service_request", "Request started.");
  const complete = useWorkMutation("complete_service_request", "Request completed.");
  const cancel = useWorkMutation("cancel_service_request", "Request cancelled.");
  if (!can("svc.view") && !can("svc.order.complete")) return <NoAccess />;

  const list = data.filter((r) =>
    (status === "active" ? ACTIVE.includes(r.status) : status === "mine" ? r.assignee_id === ctx.user_id && ACTIVE.includes(r.status) : status === "all" || r.status === status) &&
    (!q || `${r.description} ${r.guest_name ?? ""} ${r.room_number ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Service requests" description="Create new requests from the In house list on the Front Desk. Charges go on the guest's folio when a request is completed." />
      <div className="mb-3 md:hidden">
        <ViewSwitch label="Show requests" value={["active", "mine", "all"].includes(status) ? status : "active"} onChange={setStatus}
          options={[{ key: "active", label: "Not finished" }, { key: "mine", label: "Mine" }, { key: "all", label: "All" }]} />
      </div>
      <FilterBar>
        <Input className="w-64" placeholder="Search request, guest or room" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48 max-md:hidden"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Not finished</SelectItem>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(SVC_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>
      <div className="space-y-3 md:hidden" aria-label="Service requests as cards">
        {isLoading ? <LoadingState label="Loading requests…" />
          : list.length === 0 ? <EmptyState title="No service requests" description="Use the In house list on the Front Desk to add one." />
          : list.map((r) => (
            <ServiceCard key={r.id} r={r} live={ACTIVE.includes(r.status)} worker={can("svc.order.complete")}
              canAssign={can("svc.order.create")} canCancel={can("svc.order.cancel") || (r.created_by === ctx.user_id && r.status === "open")}
              busy={start.isPending || complete.isPending}
              onStart={() => start.mutate({ p_id: r.id })} onComplete={() => complete.mutate({ p_id: r.id })}
              onAssign={() => setAssign(r)} onCancel={() => setCancelling(r)} />
          ))}
      </div>
      <div className="max-md:hidden"><Table wide>
        <TableHeader><TableRow>
          <TableHead>Room</TableHead><TableHead>Request</TableHead><TableHead>Status</TableHead><TableHead>Assigned to</TableHead>
          <TableHead className="text-right">Charge</TableHead><TableHead>Created</TableHead><TableHead className="w-44" />
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={7} />}
          {!isLoading && list.length === 0 && <TableStateRow colSpan={7} title="No service requests" description="Use the In house list on the Front Desk to add one." />}
          {list.map((r) => {
            const live = ACTIVE.includes(r.status);
            const worker = can("svc.order.complete");
            const more = [
              can("svc.order.create") && live && <DropdownMenuItem key="a" className="h-10" onClick={() => setAssign(r)}>{r.assignee_id ? "Reassign" : "Assign"}</DropdownMenuItem>,
              live && (can("svc.order.cancel") || (r.created_by === ctx.user_id && r.status === "open")) &&
                <DropdownMenuItem key="c" className="h-10 text-destructive" onClick={() => setCancelling(r)}>Cancel request</DropdownMenuItem>,
            ].filter(Boolean);
            return (
              <TableRow key={r.id}>
                <TableCell>{r.room_number ? <RoomName label={r.room_number} /> : "—"}
                  <Link to="/reservations/$id" params={{ id: r.reservation_id }} className="block text-sm font-normal text-primary-strong hover:underline">{r.guest_name ?? r.reservation_number}</Link>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{SVC_CATEGORIES[r.category] ?? r.category}</span>
                  <span className="block">{r.description}</span>
                  {r.cancel_reason && <span className="block text-sm text-muted-foreground">Cancelled: {r.cancel_reason}</span>}
                </TableCell>
                <TableCell><StatusBadge map={SVC_STATUS} value={r.status} /></TableCell>
                <TableCell>{r.assignee_name ?? <span className="text-muted-foreground">Nobody</span>}</TableCell>
                <TableCell className="text-right">
                  {r.chargeable ? <>
                    <Money amount={r.charge_amount} currency={r.currency} />
                    <span className="block text-sm text-muted-foreground">{r.charge_code_name}</span>
                    {r.posted_transaction_id && <Badge variant="success">On folio</Badge>}
                  </> : <span className="text-muted-foreground">Free</span>}
                </TableCell>
                <TableCell className="tabular text-sm">{formatDateTime(r.created_at)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {worker && ["open", "assigned"].includes(r.status) && <Button size="sm" variant="outline" disabled={start.isPending} onClick={() => start.mutate({ p_id: r.id })}>Start</Button>}
                    {worker && live && <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate({ p_id: r.id })}>Complete</Button>}
                    {more.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More actions"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">{more}</DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table></div>
      <AssignServiceDialog req={assign} onOpenChange={(o) => !o && setAssign(null)} />
      <TextReasonDialog open={!!cancelling} title="Cancel request" label="Reason" busy={cancel.isPending}
        onOpenChange={(o) => !o && setCancelling(null)}
        onSubmit={(reason) => cancel.mutate({ p_id: cancelling!.id, p_reason: reason }, { onSuccess: () => setCancelling(null) })} />
    </div>
  );
}

/** One request as a card for a phone: room first, what is wanted, the charge, and one large action. */
function ServiceCard({ r, live, worker, canAssign, canCancel, busy, onStart, onComplete, onAssign, onCancel }: {
  r: ServiceRequest; live: boolean; worker: boolean; canAssign: boolean; canCancel: boolean; busy: boolean;
  onStart: () => void; onComplete: () => void; onAssign: () => void; onCancel: () => void;
}) {
  const startable = worker && ["open", "assigned"].includes(r.status);
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-semibold leading-tight">{r.room_number ? <RoomName label={r.room_number} /> : "No room"}</span>
        <StatusBadge map={SVC_STATUS} value={r.status} />
      </div>
      <p className="text-[17px] font-semibold [overflow-wrap:anywhere]">{r.description}</p>
      <p className="text-sm text-muted-foreground">
        <Link to="/reservations/$id" params={{ id: r.reservation_id }} className="text-primary-strong hover:underline">{r.guest_name ?? r.reservation_number}</Link>
        {" · "}{SVC_CATEGORIES[r.category] ?? r.category}{r.assignee_name ? ` · ${r.assignee_name}` : " · Nobody assigned"}
      </p>
      {r.cancel_reason && <p className="text-sm text-muted-foreground">Cancelled: {r.cancel_reason}</p>}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {r.chargeable ? <>
          <Money amount={r.charge_amount} currency={r.currency} className="text-base font-semibold" />
          {r.posted_transaction_id ? <Badge variant="success">On folio</Badge> : live && <span className="text-muted-foreground">Posts to the folio when completed</span>}
        </> : <span className="text-muted-foreground">Free</span>}
      </div>
      {worker && live && (startable
        ? <Button size="lg" className="w-full" variant="outline" disabled={busy} onClick={onStart}>Start</Button>
        : null)}
      {worker && live && <Button size="lg" className="w-full" disabled={busy} onClick={onComplete}>Complete</Button>}
      {live && (canAssign || canCancel) && (
        <div className="flex flex-wrap gap-2">
          {canAssign && <Button size="sm" variant="ghost" className="pointer-coarse:h-11" onClick={onAssign}>{r.assignee_id ? "Reassign" : "Assign"}</Button>}
          {canCancel && <Button size="sm" variant="ghost" className="text-destructive pointer-coarse:h-11" onClick={onCancel}>Cancel request</Button>}
        </div>
      )}
    </div>
  );
}
