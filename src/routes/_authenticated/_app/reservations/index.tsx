import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { useAccess } from "@/lib/access";
import { RES_STATUS, ResStatusBadge, formatDay, nightsBetween, useReservationSearch } from "@/lib/reservations";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/reservations/")({ component: ReservationList });

function ReservationList() {
  const { property, can } = useAccess();
  const navigate = useNavigate();
  const [f, setF] = useState({ q: "", status: "all", from: property?.business_date ?? "", to: "" });
  const { data = [], isLoading } = useReservationSearch(property?.id, f);
  const filtered = f.q || f.status !== "all" || f.from || f.to;

  return (
    <div>
      <PageHeader title="Reservations" description="Search bookings by guest, booking number, company or phone."
        actions={<>
          <Button variant="outline" asChild><Link to="/reservations/availability">Availability</Link></Button>
          {can("res.create") && <Button asChild><Link to="/reservations/new">New booking</Link></Button>}
        </>} />
      <FilterBar>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search" aria-label="Search reservations" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(RES_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">From
          <Input type="date" className="w-44" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">To
          <Input type="date" className="w-44" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        {filtered && <Button variant="ghost" onClick={() => setF({ q: "", status: "all", from: "", to: "" })}>Clear</Button>}
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Booking</TableHead><TableHead>Guest</TableHead><TableHead>Arrival</TableHead><TableHead>Departure</TableHead>
          <TableHead>Nights</TableHead><TableHead>Room</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={8} />}
          {!isLoading && data.length === 0 && (
            <TableStateRow colSpan={8} title={filtered ? "No bookings match" : "No bookings yet"}
              description={filtered ? "Try clearing the filters." : "New bookings will appear here."} />
          )}
          {data.map((r) => (
            <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate({ to: "/reservations/$id", params: { id: r.id } })}>
              <TableCell className="font-medium">
                <Link to="/reservations/$id" params={{ id: r.id }} className="text-primary-strong hover:underline" onClick={(e) => e.stopPropagation()}>{r.number}</Link>
              </TableCell>
              <TableCell>{r.guest_name}{r.company_name && <span className="block text-sm text-muted-foreground">{r.company_name}</span>}</TableCell>
              <TableCell className="tabular">{formatDay(r.arrival_date)}</TableCell>
              <TableCell className="tabular">{formatDay(r.departure_date)}</TableCell>
              <TableCell className="tabular">{nightsBetween(r.arrival_date, r.departure_date)}</TableCell>
              <TableCell>{r.room_type_code}{r.room_number && <span className="text-muted-foreground"> · {r.room_number}</span>}</TableCell>
              <TableCell><ResStatusBadge status={r.status} holdUntil={r.hold_until} /></TableCell>
              <TableCell><Money amount={r.total_amount} currency={r.currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
