import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { FOLIO_PAGE, useFolioList } from "@/lib/folios";
import { formatDay } from "@/lib/reservations";
import { PageHeader, FilterBar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { LoadMore } from "@/components/ui/load-more";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/folios/")({ component: FolioList });

function FolioList() {
  const { property } = useAccess();
  const [status, setStatus] = useState("open");
  const [limit, setLimit] = useState(FOLIO_PAGE);
  const [find, setFind] = useState("");
  const [owingOnly, setOwingOnly] = useState(false);
  const { data: all = [], isLoading, isFetching } = useFolioList(property?.id, status, limit);
  const needle = find.trim().toLowerCase();
  const data = all.filter((f) => (!owingOnly || Number(f.amount_due) > 0)
    && (!needle || [f.guest_name, f.number, f.room_number, f.reservation_number].some((v) => (v ?? "").toLowerCase().includes(needle))));
  return (
    <div>
      <PageHeader title="Folios" description="Every guest bill. Folios open when a guest checks in or when a deposit is recorded." />
      <FilterBar>
        <Input aria-label="Find a folio" placeholder="Find a guest, room or folio number" value={find} onChange={(e) => setFind(e.target.value)} className="w-full sm:w-72" />
        <Button variant={owingOnly ? "default" : "outline"} aria-pressed={owingOnly} onClick={() => setOwingOnly(!owingOnly)}>Owing only</Button>
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
          {!isLoading && data.length === 0 && <TableStateRow colSpan={6} title={needle || owingOnly ? "No folios match" : "No folios"} />}
          {data.map((f) => (
            <TableRow key={f.folio_id}>
              <TableCell><Link to="/folios/$id" params={{ id: f.folio_id }} className="font-medium text-primary-strong hover:underline">{f.number}</Link>
                <span className="block text-sm text-muted-foreground">{f.label}</span></TableCell>
              <TableCell>{f.guest_name ?? "—"}<span className="block text-sm text-muted-foreground">{f.reservation_number}</span></TableCell>
              <TableCell>{f.room_number ? <RoomName label={f.room_number} className="font-normal" /> : "—"}</TableCell>
              <TableCell className="tabular">{formatDay(f.arrival_date)} – {formatDay(f.departure_date)}</TableCell>
              <TableCell>{f.status === "open" ? <Badge variant="info">Open</Badge> : <Badge variant="neutral">Closed</Badge>}</TableCell>
              <TableCell><div className="flex flex-col items-end gap-1"><Money amount={f.balance} currency={f.currency} />{Number(f.amount_due) > 0 && <Badge variant="warning">Owing</Badge>}</div></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <LoadMore shown={all.length} hasMore={all.length >= limit} loading={isFetching} onClick={() => setLimit(limit + FOLIO_PAGE)} />
    </div>
  );
}
