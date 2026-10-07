import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, BedDouble, MoreHorizontal, Sparkles } from "lucide-react";
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { formatDay, ResStatusBadge, nightsLabel } from "@/lib/reservations";
import {
  CheckInDialog, ExtendStayDialog, MoveRoomDialog, RoomStateBadge, useArrivals, useInHouse, VoidCheckInDialog, WalkInDialog,
  type ArrivalRow, type InHouseRow,
} from "@/lib/front-desk";
import { useOpenMainFolio } from "@/lib/folios";
import { NewServiceRequestDialog, type ServiceGuest } from "@/lib/maintenance";
import { usePostRoomCharges } from "@/lib/checkout";
import { PageHeader } from "@/components/page-header";
import { FilledStat, StatTile } from "@/components/stats";
import { useDashboardSummary } from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/front-desk")({
  head: () => ({ meta: [{ title: "Front Desk · Hotel Desk" }] }),
  component: FrontDesk,
});

function FrontDesk() {
  const { property, can } = useAccess();
  const arrivals = useArrivals(property?.id);
  const inHouse = useInHouse(property?.id);
  const [checkIn, setCheckIn] = useState<ArrivalRow | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [move, setMove] = useState<InHouseRow | null>(null);
  const [extend, setExtend] = useState<InHouseRow | null>(null);
  const [voiding, setVoiding] = useState<InHouseRow | null>(null);
  const [svc, setSvc] = useState<ServiceGuest | null>(null);
  const openFolio = useOpenMainFolio();
  const roomCharges = usePostRoomCharges();
  const summary = useDashboardSummary();
  if (!can("fo.view")) return <NoAccess />;

  const departures = (inHouse.data ?? []).filter((s) => s.is_departing);
  const guestCell = (id: string, number: string, name: string | null, company: string | null, noWrap = false) => (
    <TableCell>
      <Link to="/reservations/$id" params={{ id }} className="font-medium text-primary-strong hover:underline">{name ?? "Guest"}</Link>
      <span className={`block text-sm text-muted-foreground${noWrap ? " whitespace-nowrap" : ""}`}>{number}{company ? ` · ${company}` : ""}</span>
    </TableCell>
  );

  const stayTable = (rows: InHouseRow[], loading: boolean, empty: string) => (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Room</TableHead><TableHead>Guest</TableHead><TableHead>Arrived</TableHead><TableHead>Departure</TableHead>
        <TableHead>Guests</TableHead><TableHead className="text-right">Total</TableHead><TableHead />
      </TableRow></TableHeader>
      <TableBody>
        {loading && <TableSkeletonRows cols={7} />}
        {!loading && rows.length === 0 && <TableStateRow colSpan={7} title={empty} />}
        {rows.map((s) => {
          const actions = [
            can("fo.checkout") && <DropdownMenuItem key="c" className="h-10" asChild><Link to="/checkout/$id" params={{ id: s.reservation_id }}>Check out</Link></DropdownMenuItem>,
            can("fin.folio.view") && <DropdownMenuItem key="f" className="h-10" onClick={() => openFolio.mutate(s.reservation_id)}>Open folio</DropdownMenuItem>,
            can("svc.order.create") && <DropdownMenuItem key="s" className="h-10" onClick={() => setSvc(s)}>Service request</DropdownMenuItem>,
            can("fo.room.move") && !s.is_departing && <DropdownMenuItem key="m" className="h-10" onClick={() => setMove(s)}>Move room</DropdownMenuItem>,
            can("fo.stay.extend") && <DropdownMenuItem key="e" className="h-10" onClick={() => setExtend(s)}>Change departure</DropdownMenuItem>,
            can("fo.checkin.void") && s.can_void && <DropdownMenuItem key="v" className="h-10 text-destructive" onClick={() => setVoiding(s)}>Void check-in</DropdownMenuItem>,
          ].filter(Boolean);
          return (
            <TableRow key={s.stay_id}>
              <TableCell><RoomName label={s.room_number} /></TableCell>
              {guestCell(s.reservation_id, s.number, s.guest_name, s.company_name, true)}
              <TableCell className="tabular">{formatDay(s.arrival_date)}</TableCell>
              <TableCell className="tabular">{formatDay(s.departure_date)}{s.is_departing && <Badge variant="warning" className="ml-2">Due out</Badge>}</TableCell>
              <TableCell className="tabular">{s.adults}{s.children ? ` + ${s.children}` : ""}</TableCell>
              <TableCell><Money amount={s.total_amount} currency={s.currency} /></TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {/* Plain button for the most common action; the same link stays in the menu. DOM order = keyboard order. */}
                {can("fo.checkout") && (
                  <Button size="sm" variant="outline" className="mr-1" asChild>
                    <Link to="/checkout/$id" params={{ id: s.reservation_id }} aria-label={`Check out room ${s.room_number}`}>Check out</Link>
                  </Button>
                )}
                {actions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for room ${s.room_number}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div>
      <PageHeader title="Front Desk" description={`Today's arrivals, in-house guests and departures for ${property?.name ?? ""}.`}
        actions={<>
          {can("fin.nightaudit.run") && property && <Button variant="outline" disabled={roomCharges.isPending} onClick={() => roomCharges.mutate(property.id)}>Post room charges</Button>}
          {can("fo.walkin") && can("fo.checkin") && <Button onClick={() => setWalkIn(true)}>Walk-in</Button>}
        </>} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FilledStat icon={ArrowDownRight} label="Arrivals today" value={arrivals.data?.length}
          sub={`${(arrivals.data ?? []).filter((a) => !a.room_number).length} without a room yet`} />
        <StatTile icon={BedDouble} tone="info" label="In house" value={inHouse.data?.length} sub="Guests staying tonight" />
        <StatTile icon={ArrowUpRight} tone="accent" label="Departures today" value={departures.length} sub="Due to check out" />
        <StatTile icon={Sparkles} tone="success" label="Rooms ready" value={summary.data?.vacant_clean} sub="Vacant and clean" to={can("room.view") ? "/rooms" : undefined} />
      </div>
      <Tabs defaultValue="arrivals">
        <TabsList className="mb-3">
          <TabsTrigger value="arrivals">Arrivals ({arrivals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="in-house">In house ({inHouse.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="departures">Departures today ({departures.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="arrivals">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Guest</TableHead><TableHead>Stay</TableHead><TableHead>Room</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Deposit due</TableHead><TableHead className="w-32" />
            </TableRow></TableHeader>
            <TableBody>
              {arrivals.isLoading && <TableSkeletonRows cols={6} />}
              {!arrivals.isLoading && (arrivals.data ?? []).length === 0 && <TableStateRow colSpan={6} title="No arrivals today" description="Bookings arriving on the business date appear here." />}
              {(arrivals.data ?? []).map((a) => (
                <TableRow key={a.id}>
                  {guestCell(a.id, a.number, a.guest_name, a.company_name)}
                  <TableCell className="tabular">
                    {formatDay(a.arrival_date)} – {formatDay(a.departure_date)}
                    <span className="block text-sm text-muted-foreground">{nightsLabel(a.nights)} · {a.room_type_code}</span>
                    {a.is_late && <Badge variant="danger">Late arrival</Badge>}
                    {a.arrival_ready && <Badge variant="success">Ready</Badge>}
                  </TableCell>
                  <TableCell>
                    {a.room_number
                      ? <span className="inline-flex items-center gap-2"><RoomName label={a.room_number} /><RoomStateBadge condition={a.room_condition} occupied={a.room_is_occupied} /></span>
                      : <span className="text-muted-foreground">Not assigned</span>}
                  </TableCell>
                  <TableCell><ResStatusBadge status={a.status} holdUntil={a.hold_until} /></TableCell>
                  <TableCell><Money amount={a.deposit_due} currency={a.currency} /></TableCell>
                  <TableCell className="text-right">{can("fo.checkin") && <Button size="sm" onClick={() => setCheckIn(a)}>Check in</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="in-house">{stayTable(inHouse.data ?? [], inHouse.isLoading, "No guests in house")}</TabsContent>
        <TabsContent value="departures">
          {stayTable(departures, inHouse.isLoading, "No departures today")}
        </TabsContent>
      </Tabs>

      <CheckInDialog arrival={checkIn} onOpenChange={(o) => !o && setCheckIn(null)} />
      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} />
      <MoveRoomDialog stay={move} onOpenChange={(o) => !o && setMove(null)} />
      <ExtendStayDialog stay={extend} onOpenChange={(o) => !o && setExtend(null)} />
      <NewServiceRequestDialog guest={svc} onOpenChange={(o) => !o && setSvc(null)} />
      <VoidCheckInDialog stay={voiding} onOpenChange={(o) => !o && setVoiding(null)} />
    </div>
  );
}
