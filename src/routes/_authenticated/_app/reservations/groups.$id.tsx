import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, BedDouble, CalendarDays, Receipt, Wallet } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDay, ResStatusBadge, useResMutation } from "@/lib/reservations";
import { useGroupDetail } from "@/lib/groups";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { EmptyState, LoadingState, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/reservations/groups/$id")({ component: GroupDetailPage });

function GroupDetailPage() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const { data, isLoading, error } = useGroupDetail(id);
  const setStatus = useResMutation("set_group_booking_status", "Group updated.");
  if (isLoading) return <LoadingState label="Loading group…" />;
  if (error || !data) return <EmptyState title="Group not found" action={<Button variant="outline" asChild><Link to="/reservations/groups">All groups</Link></Button>} />;
  const { group: g, reservations, totals: t } = data;
  const active = g.status === "active";
  const live = reservations.filter((r) => r.status !== "cancelled" && r.status !== "no_show").length;
  return (
    <div>
      <Link to="/reservations/groups" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">{g.name} {active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Cancelled</Badge>}</span>}
        description={[g.contact_name, g.contact_phone].filter(Boolean).join(" · ") || "No contact saved"}
        actions={<>
          {active && can("res.create") && <Button asChild><Link to="/reservations/new" search={{ group: g.id }}>Add a room</Link></Button>}
          {can("res.group.manage") && active && (
            <Button variant="outline" disabled={setStatus.isPending || live > 0}
              title={live > 0 ? "Cancel or move the bookings first." : undefined}
              onClick={() => setStatus.mutate({ p_id: g.id, p_status: "cancelled" })}>Cancel group</Button>
          )}
          {can("res.group.manage") && !active && <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate({ p_id: g.id, p_status: "active" })}>Reactivate</Button>}
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={BedDouble} label="Rooms" value={t.rooms} sub="Live bookings" />
        <StatTile icon={CalendarDays} tone="info" label="Room nights" value={t.nights} sub="All rooms" />
        <StatTile icon={Receipt} tone="success" label="Total" value={<Money amount={t.total_amount} currency={t.currency} className="text-left" />} sub="Room charges" />
        <StatTile icon={Wallet} tone="warning" label="Balance due" value={t.balance_due === null ? "—" : <Money amount={t.balance_due} currency={t.currency} className="text-left" />}
          sub={t.balance_due === null ? "You cannot see folios" : `Deposit required ${t.deposit_required}`} />
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Booking</TableHead><TableHead>Guest</TableHead><TableHead>Arrival</TableHead><TableHead>Departure</TableHead>
          <TableHead>Room</TableHead><TableHead>Ready</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {reservations.length === 0 && <TableStateRow colSpan={8} title="No rooms yet" description="Use Add a room to book the first one." />}
          {reservations.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium"><Link to="/reservations/$id" params={{ id: r.id }} className="text-primary-strong hover:underline">{r.number}</Link></TableCell>
              <TableCell>{r.guest_name}</TableCell>
              <TableCell className="tabular">{formatDay(r.arrival_date)}</TableCell>
              <TableCell className="tabular">{formatDay(r.departure_date)}</TableCell>
              <TableCell>{r.room_number ? <RoomName label={r.room_number} className="font-normal" /> : <span className="text-muted-foreground">{r.room_type_code} · not assigned</span>}</TableCell>
              <TableCell>{r.arrival_ready ? <Badge variant="success">Ready</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell><ResStatusBadge status={r.status} holdUntil={null} /></TableCell>
              <TableCell><Money amount={r.total_amount} currency={r.currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
