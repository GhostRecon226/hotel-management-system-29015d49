import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDateTime } from "@/lib/reservations";
import { NewTicketDialog, PRIORITY, StatusBadge, TICKET_STATUS, useTickets } from "@/lib/maintenance";
import { FilterBar, PageHeader } from "@/components/page-header";
import { AlertTriangle, UserX, UserCheck, Wrench } from "lucide-react";
import { FilledStat, StatTile } from "@/components/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({ component: TicketList });

const ACTIVE = ["open", "assigned", "in_progress", "waiting", "resolved"];

function TicketList() {
  const { can, ctx } = useAccess();
  const navigate = useNavigate();
  const { data = [], isLoading } = useTickets();
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("all");
  const [q, setQ] = useState("");
  const list = data.filter((t) =>
    (status === "active" ? ACTIVE.includes(t.status) : status === "mine" ? t.assignee_id === ctx.user_id && ACTIVE.includes(t.status) : status === "all" || t.status === status) &&
    (priority === "all" || t.priority === priority) &&
    (!q || `${t.title} ${t.room_number ?? ""} ${t.location ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  const active = data.filter((t) => ACTIVE.includes(t.status));
  return (
    <div>
      <PageHeader title="Maintenance" description="Repair tickets for rooms and public areas."
        actions={can("mnt.ticket.create") && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Report a problem</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FilledStat icon={Wrench} label="Open tickets" value={isLoading ? "—" : active.length} sub="Not finished yet" />
        <StatTile icon={AlertTriangle} tone="danger" label="Urgent" value={isLoading ? "—" : active.filter((t) => t.priority === "urgent").length} sub="Open and urgent" />
        <StatTile icon={UserX} tone="warning" label="Nobody assigned" value={isLoading ? "—" : active.filter((t) => !t.assignee_id).length} sub="Open, waiting for someone" />
        <StatTile icon={UserCheck} tone="accent" label="Assigned to me" value={isLoading ? "—" : active.filter((t) => t.assignee_id === ctx.user_id).length} sub="Open" />
      </div>
      <FilterBar>
        <Input className="w-64" placeholder="Search problem, room or place" aria-label="Search tickets" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Not finished</SelectItem>
            <SelectItem value="mine">Assigned to me</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {Object.entries(TICKET_STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40" aria-label="Priority"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any priority</SelectItem>
            {Object.entries(PRIORITY).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Problem</TableHead><TableHead>Where</TableHead><TableHead>Priority</TableHead>
          <TableHead>Status</TableHead><TableHead>Assigned to</TableHead><TableHead>Reported</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={6} />}
          {!isLoading && list.length === 0 && <TableStateRow colSpan={6} title="No tickets" description="Problems reported by staff appear here." />}
          {list.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate({ to: "/maintenance/$id", params: { id: t.id } })}>
              <TableCell>
                <Link to="/maintenance/$id" params={{ id: t.id }} className="font-medium text-primary-strong hover:underline">{t.title}</Link>
                {t.has_approved_block ? <Badge variant="danger" className="ml-2">Room blocked</Badge> : t.has_active_block ? <Badge variant="warning" className="ml-2">Block requested</Badge> : null}
              </TableCell>
              <TableCell>{t.room_number ? <RoomName label={t.room_number} /> : null}{t.location && <span className="block text-sm text-muted-foreground">{t.location}</span>}</TableCell>
              <TableCell><StatusBadge map={PRIORITY} value={t.priority} /></TableCell>
              <TableCell><StatusBadge map={TICKET_STATUS} value={t.status} /></TableCell>
              <TableCell>{t.assignee_name ?? <span className="text-muted-foreground">Nobody</span>}</TableCell>
              <TableCell className="tabular text-sm">{formatDateTime(t.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <NewTicketDialog open={adding} onOpenChange={setAdding} onCreated={(id) => navigate({ to: "/maintenance/$id", params: { id } })} />
    </div>
  );
}
