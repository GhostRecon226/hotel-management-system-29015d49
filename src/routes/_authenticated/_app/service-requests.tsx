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

export const Route = createFileRoute("/_authenticated/_app/service-requests")({
  head: () => ({
    meta: [
      { title: "Service requests — Hotel Desk" },
      { name: "description", content: "Guest requests from in-house guests, with charges posted to the folio when done." },
      { property: "og:title", content: "Service requests — Hotel Desk" },
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
      <FilterBar>
        <Input className="w-64" placeholder="Search request, guest or room" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Not finished</SelectItem>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(SVC_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>
      <Table>
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
      </Table>
      <AssignServiceDialog req={assign} onOpenChange={(o) => !o && setAssign(null)} />
      <TextReasonDialog open={!!cancelling} title="Cancel request" label="Reason" busy={cancel.isPending}
        onOpenChange={(o) => !o && setCancelling(null)}
        onSubmit={(reason) => cancel.mutate({ p_id: cancelling!.id, p_reason: reason }, { onSuccess: () => setCancelling(null) })} />
    </div>
  );
}
