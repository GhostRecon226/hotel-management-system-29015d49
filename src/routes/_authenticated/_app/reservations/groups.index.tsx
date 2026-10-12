import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { formatDay } from "@/lib/reservations";
import { useGroupList } from "@/lib/groups";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/reservations/groups/")({ component: GroupList });

function GroupList() {
  const { property } = useAccess();
  const navigate = useNavigate();
  const [status, setStatus] = useState("active");
  const { data = [], isLoading } = useGroupList(property?.id, status);
  return (
    <div>
      <Link to="/reservations" className="mb-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Reservations
      </Link>
      <PageHeader title="Group bookings" description="Weddings, teams and tours. Each group holds many bookings under one name." />
      <FilterBar>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Group</TableHead><TableHead>Contact</TableHead><TableHead>Arrives</TableHead><TableHead>Leaves</TableHead>
          <TableHead>Rooms</TableHead><TableHead>Nights</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={8} />}
          {!isLoading && data.length === 0 && <TableStateRow colSpan={8} title="No groups" description="Create a group from the booking form, then add rooms to it." />}
          {data.map((g) => (
            <TableRow key={g.id} className="cursor-pointer" onClick={() => navigate({ to: "/reservations/groups/$id", params: { id: g.id } })}>
              <TableCell className="font-medium text-primary-strong">{g.name}</TableCell>
              <TableCell>{g.contact_name ?? "—"}{g.contact_phone && <span className="block text-sm text-muted-foreground">{g.contact_phone}</span>}</TableCell>
              <TableCell className="tabular">{g.first_arrival ? formatDay(g.first_arrival) : "—"}</TableCell>
              <TableCell className="tabular">{g.last_departure ? formatDay(g.last_departure) : "—"}</TableCell>
              <TableCell className="tabular">{g.rooms}</TableCell>
              <TableCell className="tabular">{g.nights}</TableCell>
              <TableCell>{g.status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Cancelled</Badge>}</TableCell>
              <TableCell><Money amount={g.total_amount} currency={g.currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
