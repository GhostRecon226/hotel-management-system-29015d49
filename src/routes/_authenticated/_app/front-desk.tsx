import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, BedDouble, MoreHorizontal, Search, Sparkles } from "lucide-react";
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
import { FilterBar, PageHeader } from "@/components/page-header";
import { FilledStat, StatTile } from "@/components/stats";
import { useDashboardSummary } from "@/lib/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RoomName } from "@/components/room-name";
import { ArrivalCard, DepartureCard, matchesSearch, RoomTiles } from "@/components/front-desk-board";
import { useRoomBoard } from "@/lib/rooms";
import { cn } from "@/lib/utils";

type View = "arrivals" | "departures" | "in-house" | "rooms";

export const Route = createFileRoute("/_authenticated/_app/front-desk")({
  head: () => ({ meta: [{ title: "Front Desk · Zikora" }] }),
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
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("arrivals");
  const openFolio = useOpenMainFolio();
  const roomCharges = usePostRoomCharges();
  const summary = useDashboardSummary();
  const board = useRoomBoard(can("room.view") ? property?.id : undefined);
  if (!can("fo.view")) return <NoAccess />;

  const departures = (inHouse.data ?? []).filter((s) => s.is_departing);
  const shownArrivals = (arrivals.data ?? []).filter((a) => matchesSearch(q, a.guest_name, a.number, a.room_number, a.company_name));
  const shownDepartures = departures.filter((s) => matchesSearch(q, s.guest_name, s.number, s.room_number, s.company_name));
  const shownInHouse = (inHouse.data ?? []).filter((s) => matchesSearch(q, s.guest_name, s.number, s.room_number, s.company_name));
  const shownRooms = (board.data ?? []).filter((r) => r.is_active && matchesSearch(q, r.room_number, r.current_guest_name));
  const guestCell = (id: string, number: string, name: string | null, company: string | null, noWrap = false) => (
    <TableCell>
      <Link to="/reservations/$id" params={{ id }} className="font-medium text-primary-strong hover:underline">{name ?? "Guest"}</Link>
      <span className={`block text-sm text-muted-foreground${noWrap ? " whitespace-nowrap" : ""}`}>{number}{company ? ` · ${company}` : ""}</span>
    </TableCell>
  );

  /** The same row menu on a card and in the In house table. */
  const stayActions = (s: InHouseRow) => [
    can("fo.checkout") && <DropdownMenuItem key="c" className="h-10" asChild><Link to="/checkout/$id" params={{ id: s.reservation_id }}>Check out</Link></DropdownMenuItem>,
    can("fin.folio.view") && <DropdownMenuItem key="f" className="h-10" onClick={() => openFolio.mutate(s.reservation_id)}>Open folio</DropdownMenuItem>,
    can("svc.order.create") && <DropdownMenuItem key="s" className="h-10" onClick={() => setSvc(s)}>Service request</DropdownMenuItem>,
    can("fo.room.move") && !s.is_departing && <DropdownMenuItem key="m" className="h-10" onClick={() => setMove(s)}>Move room</DropdownMenuItem>,
    can("fo.stay.extend") && <DropdownMenuItem key="e" className="h-10" onClick={() => setExtend(s)}>Change departure</DropdownMenuItem>,
    can("fo.checkin.void") && s.can_void && <DropdownMenuItem key="v" className="h-10 text-destructive" onClick={() => setVoiding(s)}>Void check-in</DropdownMenuItem>,
  ].filter(Boolean);

  const departureAction = (s: InHouseRow) => {
    const actions = stayActions(s);
    const who = s.guest_name ?? `room ${s.room_number}`;
    return (
      <span className="inline-flex items-center gap-1">
        {can("fo.checkout") && (
          <Button size="sm" className="pointer-coarse:h-11" asChild>
            <Link to="/checkout/$id" params={{ id: s.reservation_id }} aria-label={`Check out ${who}`}>Check out</Link>
          </Button>
        )}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`More actions for ${who}`}><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
          </DropdownMenu>
        )}
      </span>
    );
  };

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
          const actions = stayActions(s);
          return (
            <TableRow key={s.stay_id}>
              <TableCell><RoomName label={s.room_number} /></TableCell>
              {guestCell(s.reservation_id, s.number, s.guest_name, s.company_name, true)}
              <TableCell className="tabular">{formatDay(s.arrival_date)}</TableCell>
              <TableCell className="tabular">{formatDay(s.departure_date)}{s.is_departing && <Badge variant="warning" className="ml-2">Due out</Badge>}</TableCell>
              <TableCell className="tabular">{s.adults}{s.children ? ` + ${s.children}` : ""}</TableCell>
              <TableCell><Money amount={s.total_amount} currency={s.currency} /></TableCell>
              <TableCell className="sticky right-0 border-l border-border/60 bg-card text-right whitespace-nowrap">
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
      <PageHeader title="Front Desk" description={`Today's arrivals, departures and rooms for ${property?.name ?? ""}.`}
        actions={<>
          {can("fin.nightaudit.run") && property && <Button variant="outline" disabled={roomCharges.isPending} onClick={() => roomCharges.mutate(property.id)}>Post room charges</Button>}
          {can("fo.walkin") && can("fo.checkin") && <Button onClick={() => setWalkIn(true)}>Walk-in</Button>}
        </>} />
      <FilterBar>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest, booking or room" aria-label="Find a guest, booking or room" className="pl-10" />
        </div>
      </FilterBar>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FilledStat icon={ArrowDownRight} label="Arrivals today" value={arrivals.data?.length}
          sub={`${(arrivals.data ?? []).filter((a) => !a.room_number).length} without a room yet`} />
        <StatTile icon={BedDouble} tone="info" label="In house" value={inHouse.data?.length} sub="Guests staying tonight" />
        <StatTile icon={ArrowUpRight} tone="accent" label="Departures today" value={departures.length} sub="Due to check out" />
        <StatTile icon={Sparkles} tone="success" label="Rooms ready" value={summary.data?.vacant_clean} sub="Vacant and clean" to={can("room.view") ? "/rooms" : undefined} />
      </div>

      {/* On a phone one list shows at a time. From a large screen every list shows. */}
      <div role="group" aria-label="Show" className="mb-4 grid gap-1 rounded-xl bg-muted p-1 lg:hidden" style={{ gridTemplateColumns: `repeat(${can("room.view") ? 4 : 3}, minmax(0, 1fr))` }}>
        {([["arrivals", "Arriving"], ["departures", "Due out"], ["in-house", "In house"], ...(can("room.view") ? [["rooms", "Rooms"]] : [])] as [View, string][]).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
            className={cn("min-h-11 rounded-lg px-1 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/40", view === v ? "bg-card text-foreground shadow-card" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="fd-arriving" className={cn("min-w-0", view !== "arrivals" && "max-lg:hidden")}>
          <h2 id="fd-arriving" className="mb-3 text-lg font-semibold">Arriving today <span className="tabular text-muted-foreground">({shownArrivals.length}{q ? ` of ${arrivals.data?.length ?? 0}` : ""})</span></h2>
          <div role="table" aria-label="Arrivals today"><div role="rowgroup" className="grid gap-3">
            {arrivals.isLoading && <p role="row" className="text-sm text-muted-foreground"><span role="cell">Loading arrivals…</span></p>}
            {!arrivals.isLoading && shownArrivals.length === 0 && (
              <p role="row" className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                <span role="cell">{q ? "No arrivals match." : "No arrivals today. Bookings arriving on the business date appear here."}</span>
              </p>
            )}
            {shownArrivals.map((a) => (
              <ArrivalCard key={a.id} a={a} action={can("fo.checkin") ? <Button size="sm" className="pointer-coarse:h-11" onClick={() => setCheckIn(a)}>Check in</Button> : null} />
            ))}
          </div></div>
        </section>

        <section aria-labelledby="fd-due-out" className={cn("min-w-0", view !== "departures" && "max-lg:hidden")}>
          <h2 id="fd-due-out" className="mb-3 text-lg font-semibold">Due out today <span className="tabular text-muted-foreground">({shownDepartures.length}{q ? ` of ${departures.length}` : ""})</span></h2>
          <div role="list" aria-label="Due out today" className="grid gap-3">
            {inHouse.isLoading && <p className="text-sm text-muted-foreground">Loading departures…</p>}
            {!inHouse.isLoading && shownDepartures.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{q ? "No departures match." : "No departures today."}</p>
            )}
            {shownDepartures.map((s) => <DepartureCard key={s.stay_id} s={s} action={departureAction(s)} />)}
          </div>
        </section>
      </div>

      <section aria-labelledby="fd-in-house" className={cn("mt-6", view !== "in-house" && "max-lg:hidden")}>
        <h2 id="fd-in-house" className="mb-3 text-lg font-semibold">In house <span className="tabular text-muted-foreground">({shownInHouse.length}{q ? ` of ${inHouse.data?.length ?? 0}` : ""})</span></h2>
        {stayTable(shownInHouse, inHouse.isLoading, q ? "No guests match" : "No guests in house")}
      </section>

      {can("room.view") && (
        <section aria-labelledby="fd-rooms" className={cn("mt-6", view !== "rooms" && "max-lg:hidden")}>
          <h2 id="fd-rooms" className="mb-3 text-lg font-semibold">Rooms <span className="tabular text-muted-foreground">({shownRooms.length})</span></h2>
          <RoomTiles rooms={shownRooms} loading={board.isLoading} />
        </section>
      )}

      <CheckInDialog arrival={checkIn} onOpenChange={(o) => !o && setCheckIn(null)} />
      <WalkInDialog open={walkIn} onOpenChange={setWalkIn} />
      <MoveRoomDialog stay={move} onOpenChange={(o) => !o && setMove(null)} />
      <ExtendStayDialog stay={extend} onOpenChange={(o) => !o && setExtend(null)} />
      <NewServiceRequestDialog guest={svc} onOpenChange={(o) => !o && setSvc(null)} />
      <VoidCheckInDialog stay={voiding} onOpenChange={(o) => !o && setVoiding(null)} />
    </div>
  );
}
