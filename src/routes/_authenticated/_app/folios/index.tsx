import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { FOLIO_PAGE, useFolioList } from "@/lib/folios";
import { formatDay } from "@/lib/reservations";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { LoadMore } from "@/components/ui/load-more";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/folios/")({ component: FolioList });

function FolioList() {
  const { property } = useAccess();
  const [status, setStatus] = useState("open");
  const [limit, setLimit] = useState(FOLIO_PAGE);
  const { data = [], isLoading, isFetching } = useFolioList(property?.id, status, limit);
  return (
    <div>
      <PageHeader title="Folios" description="Every guest bill. Folios open when a guest checks in or when a deposit is recorded." />
      <FilterBar>
        <Select value={status} onValueChange={(v) => { setStatus(v); setLimit(FOLIO_PAGE); }}>
          <SelectTrigger className="w-44" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem><SelectItem value="closed">Closed</SelectItem><SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Folio</TableHead><TableHead>Guest</TableHead><TableHead>Room</TableHead><TableHead>Stay</TableHead>
          <TableHead>Status</TableHead><TableHead className="text-right">Balance</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {isLoading && <TableSkeletonRows cols={6} />}
          {!isLoading && data.length === 0 && <TableStateRow colSpan={6} title="No folios" />}
          {data.map((f) => (
            <TableRow key={f.folio_id}>
              <TableCell><Link to="/folios/$id" params={{ id: f.folio_id }} className="font-medium text-primary-strong hover:underline">{f.number}</Link>
                <span className="block text-sm text-muted-foreground">{f.label}</span></TableCell>
              <TableCell>{f.guest_name ?? "—"}<span className="block text-sm text-muted-foreground">{f.reservation_number}</span></TableCell>
              <TableCell>{f.room_number ? <RoomName label={f.room_number} className="font-normal" /> : "—"}</TableCell>
              <TableCell className="tabular">{formatDay(f.arrival_date)} – {formatDay(f.departure_date)}</TableCell>
              <TableCell>{f.status === "open" ? <Badge variant="info">Open</Badge> : <Badge variant="neutral">Closed</Badge>}</TableCell>
              <TableCell><Money amount={f.balance} currency={f.currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMore shown={data.length} hasMore={data.length >= limit} loading={isFetching} onClick={() => setLimit(limit + FOLIO_PAGE)} />
    </div>
  );
}
