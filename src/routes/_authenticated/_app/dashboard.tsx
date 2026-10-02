import { callRpc } from "@/lib/setup";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccess } from "@/lib/access";
import { formatDay } from "@/lib/reservations";
import { addDays, formatPercent, useDashboardSummary, useKpis } from "@/lib/reports";
import { PageHeader } from "@/components/page-header";
import { ArrowDownRight, ArrowUpRight, BedDouble, CheckCircle2, Gauge, Wrench } from "lucide-react";
import { AvailabilityBar, FilledStat, StatTile } from "@/components/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { EmptyState, LoadingState } from "@/components/ui/states";

export const Route = createFileRoute("/_authenticated/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Hotel Desk" },
      { name: "description", content: "Today's arrivals, rooms, approvals and 30-day performance for your hotel." },
      { property: "og:title", content: "Dashboard — Hotel Desk" },
      { property: "og:description", content: "Today's arrivals, rooms, approvals and 30-day performance for your hotel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { ctx, property, can, canAny } = useAccess();
  const s = useDashboardSummary();
  const showKpi = canAny(["rpt.operations.view", "rpt.finance.view"]);
  const to = property ? addDays(property.business_date, -1) : "";
  const from = to ? addDays(to, -29) : "";
  const kpi = useKpis(from, to, showKpi);
  // Period totals come from the database (kpi_summary), with the same definitions as the daily figures.
  const period = useQuery({
    queryKey: ["kpi-summary", property?.id, from, to], enabled: showKpi && !!property && !!from,
    queryFn: () => callRpc<{ occupancy: string | null; adr: string | null; revpar: string | null }>("kpi_summary", { p_property_id: property!.id, p_from: from, p_to: to }),
  });

  if (!property) return <PageHeader title="Dashboard" description="You are not assigned to any property yet." />;
  const d = s.data;
  const rows = (kpi.data ?? []).map((r) => ({ ...r, occ: r.occupancy == null ? null : Number(r.occupancy) * 100, label: formatDay(r.business_date, { day: "numeric", month: "short" }) }));

  const firstName = (ctx.profile?.full_name ?? "").split(" ")[0];
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description={`Welcome back${firstName ? `, ${firstName}` : ""}. ${property.name} · business date ${formatDay(property.business_date)}.`} />
      {s.isLoading ? <LoadingState label="Loading today…" /> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {showKpi ? (
            <FilledStat icon={Gauge} label="Occupancy · last 30 days" className="col-span-2 md:col-span-3 lg:col-span-1"
              value={formatPercent(period.data?.occupancy == null ? null : Number(period.data.occupancy))}>
              <dl className="grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
                <div><dt className="text-xs text-on-primary-muted">ADR</dt><dd><Money className="text-left text-[15px] font-bold" amount={period.data?.adr ?? null} currency={property.base_currency} /></dd></div>
                <div><dt className="text-xs text-on-primary-muted">RevPAR</dt><dd><Money className="text-left text-[15px] font-bold" amount={period.data?.revpar ?? null} currency={property.base_currency} /></dd></div>
              </dl>
            </FilledStat>
          ) : (
            <FilledStat icon={BedDouble} label="In house" value={d?.in_house} sub="Guests staying tonight" className="col-span-2 md:col-span-3 lg:col-span-1" />
          )}
          <StatTile icon={ArrowDownRight} tone="accent" label="Arrivals today" value={d?.arrivals} sub={`${d?.arrivals_pending ?? 0} still to arrive`} to={can("fo.view") ? "/front-desk" : undefined} />
          <StatTile icon={ArrowUpRight} tone="accent" label="Departures today" value={d?.departures} sub={`${d?.departures_pending ?? 0} still to leave`} to={can("fo.view") ? "/front-desk" : undefined} />
          {showKpi && <StatTile icon={BedDouble} tone="info" label="In house" value={d?.in_house} sub="Guests staying tonight" to={can("fo.view") ? "/front-desk" : undefined} />}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Rooms right now</CardTitle>
            {can("room.view") && <Link to="/rooms" className="text-sm font-semibold text-primary hover:underline">Room board</Link>}
          </CardHeader>
          <CardContent>
            <AvailabilityBar parts={[
              { label: "In house", count: d?.in_house ?? 0, tone: "info" },
              { label: "Vacant clean", count: d?.vacant_clean ?? 0, tone: "success" },
              { label: "Vacant dirty", count: d?.vacant_dirty ?? 0, tone: "warning" },
              { label: "Out of order", count: d?.out_of_order ?? 0, tone: "danger" },
            ]} />
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
          <StatTile compact icon={CheckCircle2} tone={d?.pending_approvals ? "warning" : "neutral"} label="Approvals waiting" value={d?.pending_approvals}
            sub={d?.pending_approvals ? "Waiting for a manager" : "Nothing waiting"} to="/approvals" />
          <StatTile compact icon={Wrench} tone={d?.urgent_tickets ? "danger" : "neutral"} label="Open maintenance tickets" value={d?.open_tickets}
            sub={d?.urgent_tickets ? `${d.urgent_tickets} urgent` : "None urgent"} to={canAny(["mnt.view", "mnt.ticket.create"]) ? "/maintenance" : undefined} />
        </div>
      </div>

      {showKpi && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Occupancy and RevPAR</CardTitle>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Last 30 days. Bars show occupancy; the line shows RevPAR.</p>
            </div>
            <Link to="/reports" className="text-sm font-semibold text-primary hover:underline">Reports</Link>
          </CardHeader>
          <CardContent>
            {kpi.isLoading ? <LoadingState label="Loading figures…" /> : rows.length === 0 ? (
              <EmptyState title="No figures yet" description="Figures appear after the first business date roll." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                    <YAxis yAxisId="occ" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={44} />
                    <YAxis yAxisId="rev" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={70}
                      tickFormatter={(v) => `₦${Intl.NumberFormat("en-NG", { notation: "compact" }).format(v)}`} />
                    <Tooltip cursor={{ fill: "var(--primary-tint)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-raised-app)" }}
                      formatter={(v: number, n: string) => n === "Occupancy" ? `${Number(v).toFixed(1)}%` : `₦${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`} />
                    <Bar yAxisId="occ" dataKey="occ" name="Occupancy" fill="var(--chart-1)" maxBarSize={36} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="rev" dataKey="revpar" name="RevPAR" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
