import { callRpc } from "@/lib/setup";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccess } from "@/lib/access";
import { formatDay, nightsBetween, nightsLabel } from "@/lib/reservations";
import { useArrivals, useInHouse } from "@/lib/front-desk";
import { addDays, formatPercent, useDashboardSummary, useKpis, useRecentActivity } from "@/lib/reports";
import { PageHeader } from "@/components/page-header";
import { SetupCard } from "@/components/setup-checklist";
import { MorningBrief } from "@/components/morning-brief";
import { OwnerSummaryCard } from "@/components/owner-summary";
import { ArrowDownRight, ArrowUpRight, BedDouble, CalendarPlus, CheckCircle2, Receipt, Sparkles, UserPlus, Wrench, LogOut, KeyRound, type LucideIcon } from "lucide-react";
import { StatTile } from "@/components/stats";
import { ActivityItem, HeadRow, Initials, ListCard, Meta, ROW_ACTION, RoomStatusDonut, Row } from "@/components/dashboard-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Zikora" },
      { name: "description", content: "Today's arrivals, rooms, approvals and 30-day performance for your hotel." },
      { property: "og:title", content: "Dashboard — Zikora" },
      { property: "og:description", content: "Today's arrivals, rooms, approvals and 30-day performance for your hotel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type ActionTo = "/reservations/new" | "/front-desk" | "/folios";
const ARRIVAL_COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]";
const DEPARTURE_COLS = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.8fr)_7rem]";
const ROWS_SHOWN = 5;

function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const { ctx, property, can, canAny, level } = useAccess();
  const s = useDashboardSummary();
  const showKpi = canAny(["rpt.operations.view", "rpt.finance.view"]);
  const [days, setDays] = useState("7");
  const [hello, setHello] = useState("Welcome");
  useEffect(() => { setHello(greeting(new Date().getHours())); }, []);
  const today = property?.business_date ?? "";
  const to = property ? addDays(property.business_date, -1) : "";
  const from30 = to ? addDays(to, -29) : "";
  const chartFrom = to ? addDays(to, -(Number(days) - 1)) : "";
  const kpi = useKpis(chartFrom, to, showKpi);
  // Period totals come from the database (kpi_summary), with the same definitions as the daily figures.
  const period = useQuery({
    queryKey: ["kpi-summary", property?.id, from30, to], enabled: showKpi && !!property && !!from30,
    queryFn: () => callRpc<{ occupancy: string | null; adr: string | null; revpar: string | null }>("kpi_summary", { p_property_id: property!.id, p_from: from30, p_to: to }),
  });
  const seeFd = can("fo.view");
  // The database decides which lines each person may see; it refuses someone with none of these rights, so we do not ask.
  const seeActivity = can("res.view") || can("fo.view") || can("fin.folio.view") || (can("hk.view") && level("hk.view") !== "O");
  const activity = useRecentActivity(seeActivity);
  const arrivalsQ = useArrivals(seeFd ? property?.id : undefined);
  const inHouseQ = useInHouse(seeFd ? property?.id : undefined);

  if (!property) return <PageHeader title="Dashboard" description="You are not assigned to any property yet." />;
  const d = s.data;
  const rows = (kpi.data ?? []).map((r) => ({ ...r, occ: r.occupancy == null ? null : Number(r.occupancy) * 100, label: formatDay(r.business_date, { day: "numeric", month: "short" }) }));
  const firstName = (ctx.profile?.full_name ?? "").split(" ")[0];

  const arrivals = (arrivalsQ.data ?? []).filter((a) => a.arrival_date <= today);
  const departures = (inHouseQ.data ?? []).filter((r) => r.departure_date <= today);
  const withoutRoom = arrivals.filter((a) => !a.room_id).length;
  const guests = inHouseQ.data ? inHouseQ.data.reduce((n, r) => n + (r.adults ?? 0) + (r.children ?? 0), 0) : null;
  const totalRooms = d ? d.in_house + d.vacant_clean + d.vacant_dirty + d.out_of_order : 0;
  const occupiedPct = totalRooms > 0 && d ? Math.round((d.in_house / totalRooms) * 100) : null;
  // Expected tonight: guests staying on, plus arrivals still to come, minus departures still to leave (room counts, not money).
  const tonight = d && totalRooms > 0 ? Math.max(0, Math.min(totalRooms, d.in_house - d.departures_pending + d.arrivals_pending)) : null;
  const tonightPct = tonight != null && totalRooms > 0 ? Math.round((tonight / totalRooms) * 100) : null;

  const actions: { label: string; icon: LucideIcon; to: ActionTo; show: boolean; primary?: boolean }[] = [
    { label: "New reservation", icon: CalendarPlus, to: "/reservations/new", show: can("res.create"), primary: true },
    { label: "Walk-in guest", icon: UserPlus, to: "/front-desk", show: can("fo.view") },
    { label: "Check out", icon: LogOut, to: "/front-desk", show: can("fo.checkout") },
    { label: "Post room charge", icon: Receipt, to: "/folios", show: can("fin.folio.view") },
    { label: "Assign room", icon: KeyRound, to: "/front-desk", show: can("fo.view") },
  ];
  const visibleActions = actions.filter((a) => a.show);

  return (
    <div className="space-y-5">
      <section className="dash-banner relative overflow-hidden rounded-xl px-5 py-6 text-white shadow-raised sm:px-7 sm:py-7" aria-label="Welcome">
        <h1 className="sr-only">Dashboard</h1>
        <h2 className="text-[28px] font-semibold leading-tight sm:text-4xl">{hello}{firstName ? `, ${firstName}` : ""}</h2>
        <p className="mt-1.5 text-[15px] text-white/85">Here is what is happening at {property.name} today, {formatDay(property.business_date)}.</p>
        {tonight != null && (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl bg-white/10 px-4 py-2 ring-1 ring-white/15 sm:absolute sm:right-7 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:flex-col sm:items-end sm:gap-0 sm:py-3">
            <span className="text-xs uppercase tracking-wide text-white/75">Expected tonight</span>
            <span className="text-2xl font-bold tabular sm:text-3xl">{tonight} <span className="text-base font-semibold text-white/80">of {totalRooms} rooms</span></span>
            <span className="text-sm text-white/80">{tonightPct}% full</span>
          </div>
        )}
      </section>

      <SetupCard />
      <OwnerSummaryCard />
      <MorningBrief />

      {s.isLoading ? <LoadingState label="Loading today…" /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <StatTile icon={ArrowDownRight} tone="success" label="Arrivals today" value={d?.arrivals}
            sub={seeFd && arrivalsQ.data ? `${withoutRoom} without rooms yet` : `${d?.arrivals_pending ?? 0} still to arrive`} to={seeFd ? "/front-desk" : undefined} />
          <StatTile icon={BedDouble} tone="info" label="In-house guests" value={guests ?? d?.in_house}
            sub={`Across ${d?.in_house ?? 0} ${d?.in_house === 1 ? "room" : "rooms"}`} to={seeFd ? "/front-desk" : undefined} />
          <StatTile icon={ArrowUpRight} tone="warning" label="Departures today" value={d?.departures}
            sub={`${d?.departures_pending ?? 0} still to leave`} to={seeFd ? "/front-desk" : undefined} />
          <StatTile icon={KeyRound} tone="accent" label="Rooms occupied" value={d ? `${d.in_house} / ${totalRooms}` : undefined}
            sub={<>
              {occupiedPct == null ? "—" : `${occupiedPct}% occupancy`}
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-chart-track" aria-hidden><span className="block h-full rounded-full bg-primary" style={{ width: `${occupiedPct ?? 0}%` }} /></span>
            </>} to={can("room.view") ? "/rooms" : undefined} />
          <StatTile icon={Sparkles} tone="success" label="Rooms ready" value={d?.vacant_clean} sub="Vacant and clean"
            className="col-span-2 sm:col-span-1" to={can("room.view") ? "/rooms" : undefined} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <h2 className="sr-only">Needs attention</h2>
        <StatTile compact icon={CheckCircle2} tone={d?.pending_approvals ? "warning" : "neutral"} label="Approvals waiting" value={d?.pending_approvals}
          sub={d?.pending_approvals ? "Waiting for a manager" : "Nothing waiting"} to="/approvals" />
        <StatTile compact icon={Wrench} tone={d?.urgent_tickets ? "danger" : "neutral"} label="Open maintenance tickets" value={d?.open_tickets}
          sub={d?.urgent_tickets ? `${d.urgent_tickets} urgent` : "None urgent"} to={canAny(["mnt.view", "mnt.ticket.create"]) ? "/maintenance" : undefined} />
      </div>

      {visibleActions.length > 0 && (
        <section aria-label="Quick actions">
          <h2 className="mb-3 text-lg font-semibold">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {visibleActions.map(({ label, icon: Icon, to, primary }) => (
              <Button key={label} asChild variant={primary ? "default" : "outline"} className="h-12 justify-start gap-2.5 rounded-xl px-4 text-[14px] font-semibold">
                <Link to={to}><Icon className="size-[18px] shrink-0" aria-hidden /> {label}</Link>
              </Button>
            ))}
          </div>
        </section>
      )}

      {seeFd && (
        <div className="grid gap-4 2xl:grid-cols-2">
          <ListCard title="Today's arrivals" count={arrivals.length} to="/front-desk" linkLabel={`View all arrivals (${arrivals.length})`}
            empty={arrivalsQ.isLoading ? "Loading…" : arrivals.length === 0 ? "No arrivals waiting today." : undefined}>
            <HeadRow cols={ARRIVAL_COLS} labels={["Guest", "Room", "Reservation", "Status", ""]} />
            {arrivals.slice(0, ROWS_SHOWN).map((a) => (
              <Row key={a.id} cols={ARRIVAL_COLS}>
                <div className="flex min-w-0 items-center gap-3"><Initials name={a.guest_name} /><span className="truncate font-medium">{a.guest_name ?? "Guest"}</span></div>
                <Meta>
                <span className="text-sm text-muted-foreground md:text-foreground">{a.room_number ?? a.room_type_code}</span>
                <Link to="/reservations/$id" params={{ id: a.id }} className="text-sm text-primary-strong hover:underline">{a.number}</Link>
                <span>{a.is_late ? <Badge variant="danger">Late</Badge> : !a.room_id ? <Badge variant="warning">Needs a room</Badge> : a.room_is_ready ? <Badge variant="success">Ready</Badge> : <Badge variant="warning">Room not ready</Badge>}</span>
                </Meta>
                <Button asChild variant="outline" size="sm" className={ROW_ACTION}><Link to="/front-desk">{a.room_id ? "Check in" : "Assign room"}</Link></Button>
              </Row>
            ))}
          </ListCard>
          <ListCard title="Today's departures" count={departures.length} to="/front-desk" linkLabel={`View all departures (${departures.length})`}
            empty={inHouseQ.isLoading ? "Loading…" : departures.length === 0 ? "No departures due today." : undefined}>
            <HeadRow cols={DEPARTURE_COLS} labels={["Guest", "Room", "Nights", "Total", "Status", ""]} />
            {departures.slice(0, ROWS_SHOWN).map((r) => (
              <Row key={r.stay_id} cols={DEPARTURE_COLS}>
                <div className="flex min-w-0 items-center gap-3"><Initials name={r.guest_name} /><span className="truncate font-medium">{r.guest_name ?? "Guest"}</span></div>
                <Meta>
                <span className="text-sm text-muted-foreground md:text-foreground">{r.room_number}</span>
                <span className="text-sm text-muted-foreground md:text-foreground">{nightsLabel(nightsBetween(r.arrival_date, r.departure_date))}</span>
                <Money className="text-left text-sm md:text-right" amount={r.total_amount} currency={r.currency} />
                <span><Badge variant="warning">Due out</Badge></span>
                </Meta>
                {can("fo.checkout")
                  ? <Button asChild variant="outline" size="sm" className={ROW_ACTION}><Link to="/checkout/$id" params={{ id: r.reservation_id }} aria-label={`Check out room ${r.room_number}`}>Check out</Link></Button>
                  : <span />}
              </Row>
            ))}
          </ListCard>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        {showKpi && (
          <Card className="lg:col-span-2 2xl:col-span-1">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
              <CardTitle>Occupancy overview</CardTitle>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="h-9 w-32 rounded-lg" aria-label="Period"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem></SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {kpi.isLoading ? <LoadingState label="Loading figures…" /> : rows.length === 0 ? (
                <EmptyState title="History starts tonight" description="This chart fills in after tonight's business date roll. Today's live figures are in the tiles above." />
              ) : (
                <div className="h-56" role="img" aria-label="Occupancy rate by day">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={44} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-raised-app)" }}
                        formatter={(v: number) => [`${Number(v).toFixed(1)}%`, "Occupancy"]} />
                      <Area dataKey="occ" name="Occupancy" type="monotone" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#occFill)" dot={{ r: 3, fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border/60 pt-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Occupancy, 30 days</dt><dd className="font-bold tabular">{formatPercent(period.data?.occupancy == null ? null : Number(period.data.occupancy))}</dd></div>
                <div><dt className="text-xs text-muted-foreground">ADR</dt><dd><Money className="text-left font-bold" amount={period.data?.adr ?? null} currency={property.base_currency} /></dd></div>
                <div><dt className="text-xs text-muted-foreground">RevPAR</dt><dd><Money className="text-left font-bold" amount={period.data?.revpar ?? null} currency={property.base_currency} /></dd></div>
              </dl>
              <Link to="/reports" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Reports</Link>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Room status</CardTitle>
            {can("room.view") && <Link to="/rooms" className="text-sm font-semibold text-primary hover:underline">Room board</Link>}
          </CardHeader>
          <CardContent>
            <RoomStatusDonut total={totalRooms} parts={[
              { label: "Occupied", count: d?.in_house ?? 0, color: "var(--info)" },
              { label: "Vacant and clean", count: d?.vacant_clean ?? 0, color: "var(--success)" },
              { label: "Vacant and dirty", count: d?.vacant_dirty ?? 0, color: "var(--warning)" },
              { label: "Out of order", count: d?.out_of_order ?? 0, color: "var(--destructive)" },
            ]} />
          </CardContent>
        </Card>
        {seeActivity && !activity.isError && (
          <Card className="lg:col-span-2 2xl:col-span-1">
            <CardHeader className="pb-3"><CardTitle>Latest activity</CardTitle></CardHeader>
            <CardContent>
              {activity.isLoading ? <LoadingState label="Loading activity…" /> : (activity.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing has happened yet today.</p>
              ) : (
                <ul>{(activity.data ?? []).map((row, i) => <ActivityItem key={`${row.kind}-${row.at}-${i}`} row={row} timezone={property.timezone} />)}</ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
