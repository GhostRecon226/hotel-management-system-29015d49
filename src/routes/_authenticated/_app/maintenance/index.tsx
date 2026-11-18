import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCheck, Plus, UserX, Wrench } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDateTime } from "@/lib/reservations";
import { AssignTicketDialog, NewTicketDialog, PRIORITY, StatusBadge, TextReasonDialog, TICKET_STATUS, useTickets, useWorkMutation, type Ticket } from "@/lib/maintenance";
import { attentionItems, ageText, boardColumns, COMMON_FIXES, myJobs, nextJob, unassignedCount, workload } from "@/lib/maintenance-view";
import { BoardTicket, NeedsAttention, TicketChips, ViewSwitch, WorkloadStrip } from "@/components/maintenance-parts";
import { FilterBar, PageHeader } from "@/components/page-header";
import { FilledStat, StatTile } from "@/components/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState, TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomName } from "@/components/room-name";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/maintenance/")({ component: Maintenance });

const ACTIVE = ["open", "assigned", "in_progress", "waiting", "resolved"];
type View = "jobs" | "board" | "list";

function Maintenance() {
  const { can, ctx } = useAccess();
  const navigate = useNavigate();
  const { data = [], isLoading } = useTickets();
  const [adding, setAdding] = useState(false);
  const worker = can("mnt.ticket.work");
  const lead = can("mnt.ticket.assign");
  // A supervisor opens on the board, a technician on their own jobs, anyone else on the list.
  const [view, setView] = useState<View>(lead ? "board" : worker ? "jobs" : "list");
  const options = [
    ...(worker ? [{ key: "jobs" as const, label: "My jobs" }] : []),
    { key: "board" as const, label: "Board" }, { key: "list" as const, label: "List" },
  ];
  return (
    <div>
      <PageHeader title="Maintenance" description="Repair tickets for rooms and public areas."
        actions={can("mnt.ticket.create") && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Report a problem</Button>} />
      <div className="mb-4"><ViewSwitch label="Show" value={view} onChange={setView} options={options} /></div>
      {view === "jobs" && <MyJobs tickets={data} loading={isLoading} userId={ctx.user_id} />}
      {view === "board" && <Board tickets={data} loading={isLoading} />}
      {view === "list" && <TicketTable tickets={data} loading={isLoading} userId={ctx.user_id} />}
      <NewTicketDialog open={adding} onOpenChange={setAdding} onCreated={(id) => navigate({ to: "/maintenance/$id", params: { id } })} />
    </div>
  );
}

/* ---------- Technician: My jobs (MNT-005) ---------- */

function MyJobs({ tickets, loading, userId }: { tickets: Ticket[]; loading: boolean; userId: string }) {
  const jobs = myJobs(tickets, userId);
  const next = nextJob(jobs);
  const now = Date.now();
  if (loading) return <LoadingState label="Loading your jobs…" />;
  if (jobs.length === 0) return <EmptyState title="No jobs for you" description="New jobs appear here when a supervisor assigns them." />;
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <p className="text-sm text-muted-foreground tabular">{jobs.length} {jobs.length === 1 ? "job" : "jobs"} to do</p>
      {jobs.map((t) => <JobCard key={t.id} t={t} isNext={t.id === next?.id && jobs.length > 1} now={now} />)}
    </div>
  );
}

function JobCard({ t, isNext, now }: { t: Ticket; isNext: boolean; now: number }) {
  const start = useWorkMutation("start_ticket", "Work started.");
  const resolve = useWorkMutation("resolve_ticket", "Ticket resolved. Someone else must now check and close it.");
  const [resolving, setResolving] = useState(false);
  const started = t.status === "in_progress";
  return (
    <div className={cn("space-y-2.5 rounded-xl border bg-card p-4 shadow-card", isNext ? "border-primary/60 ring-2 ring-primary/30" : "border-border/70", t.priority === "urgent" && "border-l-4 border-l-destructive")}>
      <div className="flex items-start justify-between gap-2">
        <Link to="/maintenance/$id" params={{ id: t.id }} className="min-w-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
          <span className="block text-2xl font-semibold leading-tight">{t.room_number ?? t.location ?? "Public area"}</span>
          <span className="mt-0.5 block text-[17px] font-semibold [overflow-wrap:anywhere]">{t.title}</span>
        </Link>
        <div className="flex flex-col items-end gap-1">
          {isNext && !started && <Badge variant="brand">Next up</Badge>}
          <StatusBadge map={PRIORITY} value={t.priority} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t.room_number && t.location ? <>{t.location} · </> : null}{t.created_by_name ? `Reported by ${t.created_by_name} · ` : "Reported "}{ageText(t.created_at, now)} ago
      </p>
      {t.status === "waiting" && t.wait_reason && <p className="text-sm">Waiting for: {t.wait_reason}</p>}
      <div className="flex flex-wrap gap-1"><StatusBadge map={TICKET_STATUS} value={t.status} /><TicketChips t={t} /></div>
      {started
        ? <Button size="lg" className="w-full" onClick={() => setResolving(true)}>Mark resolved</Button>
        : <Button size="lg" className="w-full" variant={isNext ? "default" : "outline"} disabled={start.isPending} onClick={() => start.mutate({ p_id: t.id })}>{t.status === "waiting" ? "Resume work" : "Start work"}</Button>}
      <TextReasonDialog open={resolving} title="Mark resolved" label="What was done?" quick={COMMON_FIXES} busy={resolve.isPending}
        onOpenChange={setResolving} onSubmit={(r) => resolve.mutate({ p_id: t.id, p_resolution: r }, { onSuccess: () => setResolving(false) })} />
    </div>
  );
}

/* ---------- Supervisor: board and what needs attention (MNT-006) ---------- */

type Phone = "open" | "working" | "waiting" | "check";
const PHONE_LABEL: Record<Phone, string> = { open: "Open", working: "Working", waiting: "Waiting", check: "Check" };

function Board({ tickets, loading }: { tickets: Ticket[]; loading: boolean }) {
  const { can, ctx } = useAccess();
  const [assign, setAssign] = useState<Ticket | null>(null);
  const [phone, setPhone] = useState<Phone>("open");
  const close = useWorkMutation("close_ticket", "Ticket closed.");
  if (loading) return <LoadingState label="Loading tickets…" />;
  const now = Date.now();
  const active = tickets.filter((t) => ACTIVE.includes(t.status));
  const items = attentionItems(tickets, now);
  const cols = boardColumns(tickets);

  const action = (t: Ticket) => {
    if (t.status === "resolved" && can("mnt.ticket.close") && t.resolved_by !== ctx.user_id)
      return <Button size="sm" className="pointer-coarse:h-11" disabled={close.isPending} onClick={() => close.mutate({ p_id: t.id })}>Check and close</Button>;
    if (!t.assignee_id && can("mnt.ticket.assign") && ["open"].includes(t.status))
      return <Button size="sm" className="pointer-coarse:h-11" onClick={() => setAssign(t)}>Assign</Button>;
    return <Button size="sm" variant="outline" className="pointer-coarse:h-11" asChild><Link to="/maintenance/$id" params={{ id: t.id }}>Open</Link></Button>;
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FilledStat icon={Wrench} label="Open tickets" value={active.length} sub="Not finished yet" />
        <StatTile icon={AlertTriangle} tone="danger" label="Urgent" value={active.filter((t) => t.priority === "urgent").length} sub="Open and urgent" />
        <StatTile icon={UserX} tone="warning" label="Nobody assigned" value={unassignedCount(tickets)} sub="Open, waiting for someone" />
        <StatTile icon={CheckCheck} tone="accent" label="Resolved, check needed" value={tickets.filter((t) => t.status === "resolved").length} sub="Waiting for a second person" />
      </div>
      <NeedsAttention items={items} now={now} action={action} />
      <WorkloadStrip people={workload(tickets)} nobody={unassignedCount(tickets)} />
      <div role="group" aria-label="Show column" className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 md:hidden">
        {cols.map((c) => (
          <button key={c.key} type="button" aria-pressed={phone === c.key} onClick={() => setPhone(c.key)}
            className={cn("min-h-11 rounded-lg px-1 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40", phone === c.key ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>
            {PHONE_LABEL[c.key]} <span className="tabular">{c.tickets.length}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cols.map((c) => (
          <section key={c.key} aria-label={c.label} className={cn("min-w-0 rounded-xl border border-border/60 bg-muted/60 p-2.5", c.key !== phone && "max-md:hidden")}>
            <h2 className="flex items-center justify-between px-1 pb-2.5 text-sm font-bold text-foreground">
              {c.label}<span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular shadow-xs">{c.tickets.length}</span>
            </h2>
            <div className="space-y-2">
              {c.tickets.length === 0 && <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nothing here</p>}
              {c.tickets.map((t) => <BoardTicket key={t.id} t={t} now={now} />)}
            </div>
          </section>
        ))}
      </div>
      <AssignTicketDialog ticket={assign} onOpenChange={(o) => !o && setAssign(null)} />
    </>
  );
}

/* ---------- The list, as before ---------- */

function TicketTable({ tickets, loading, userId }: { tickets: Ticket[]; loading: boolean; userId: string }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("all");
  const [q, setQ] = useState("");
  const list = tickets.filter((t) =>
    (status === "active" ? ACTIVE.includes(t.status) : status === "mine" ? t.assignee_id === userId && ACTIVE.includes(t.status) : status === "all" || t.status === status) &&
    (priority === "all" || t.priority === priority) &&
    (!q || `${t.title} ${t.room_number ?? ""} ${t.location ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
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
          {loading && <TableSkeletonRows cols={6} />}
          {!loading && list.length === 0 && <TableStateRow colSpan={6} title="No tickets" description="Problems reported by staff appear here." />}
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
    </>
  );
}
