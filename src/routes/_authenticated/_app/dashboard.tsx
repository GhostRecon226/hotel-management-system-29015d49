import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAccess } from "@/lib/access";
import { formatDay } from "@/lib/reservations";
import { addDays, formatPercent, useDashboardSummary, useKpis } from "@/lib/reports";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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

function Tile({ label, value, sub, tone, to }: { label: string; value: number | undefined; sub?: ReactNode | undefined; tone?: "success" | "warning" | "danger" | "info" | undefined; to?: "/front-desk" | "/rooms" | "/approvals" | "/maintenance" | undefined }) {
  const body = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] text-muted-foreground">{label}</span>
          {tone && <Badge variant={tone} dot className="px-1.5" aria-hidden> </Badge>}
        </div>
        <div className="mt-1 text-3xl font-semibold tabular">{value ?? "—"}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Dashboard() {
  const { ctx, property, can, canAny } = useAccess();
  const s = useDashboardSummary();
  const showKpi = canAny(["rpt.operations.view", "rpt.finance.view"]);
  const to = property ? addDays(property.business_date, -1) : "";
  const from = to ? addDays(to, -29) : "";
  const kpi = useKpis(from, to, showKpi);

  if (!property) return <PageHeader title="Dashboard" description="You are not assigned to any property yet." />;
  const d = s.data;
  const rows = (kpi.data ?? []).map((r) => ({ ...r, occ: r.occupancy == null ? null : Number(r.occupancy) * 100, label: formatDay(r.business_date, { day: "numeric", month: "short" }) }));
  const totals = (kpi.data ?? []).reduce((a, r) => ({ sold: a.sold + r.rooms_sold, avail: a.avail + r.rooms_available, rev: a.rev + Number(r.room_revenue) }), { sold: 0, avail: 0, rev: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Welcome, ${ctx.profile?.full_name ?? ""}. ${property.name} · business date ${formatDay(property.business_date)}.`} />
      {s.isLoading ? <LoadingState label="Loading today…" /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Arrivals" value={d?.arrivals} sub={`${d?.arrivals_pending ?? 0} still to arrive`} to={can("fo.view") ? "/front-desk" : undefined} />
          <Tile label="Departures" value={d?.departures} sub={`${d?.departures_pending ?? 0} still to leave`} to={can("fo.view") ? "/front-desk" : undefined} />
          <Tile label="In house" value={d?.in_house} tone="info" />
          <Tile label="Vacant clean" value={d?.vacant_clean} tone="success" to={can("room.view") ? "/rooms" : undefined} />
          <Tile label="Vacant dirty" value={d?.vacant_dirty} tone="warning" to={can("room.view") ? "/rooms" : undefined} />
          <Tile label="Out of order" value={d?.out_of_order} tone="danger" to={can("room.view") ? "/rooms" : undefined} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Tile label="Approvals waiting" value={d?.pending_approvals} tone={d?.pending_approvals ? "warning" : undefined} to="/approvals" />
        <Tile label="Open maintenance tickets" value={d?.open_tickets} sub={d?.urgent_tickets ? `${d.urgent_tickets} urgent` : undefined}
          tone={d?.urgent_tickets ? "danger" : undefined} to={canAny(["mnt.view", "mnt.ticket.create"]) ? "/maintenance" : undefined} />
      </div>

      {showKpi && (
        <Card>
          <CardHeader><CardTitle>Last 30 days</CardTitle></CardHeader>
          <CardContent>
            {kpi.isLoading ? <LoadingState label="Loading figures…" /> : rows.length === 0 ? (
              <EmptyState title="No figures yet" description="Figures appear after the first business date roll." />
            ) : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  <div><div className="text-sm text-muted-foreground">Occupancy</div><div className="text-2xl font-semibold tabular">{formatPercent(totals.avail ? totals.sold / totals.avail : null)}</div></div>
                  <div className="text-right"><div className="text-sm text-muted-foreground">ADR</div><Money className="text-2xl font-semibold" amount={totals.sold ? totals.rev / totals.sold : null} currency={property.base_currency} /></div>
                  <div className="text-right"><div className="text-sm text-muted-foreground">RevPAR</div><Money className="text-2xl font-semibold" amount={totals.avail ? totals.rev / totals.avail : null} currency={property.base_currency} /></div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                      <YAxis yAxisId="occ" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={44} />
                      <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={70}
                        tickFormatter={(v) => `₦${Intl.NumberFormat("en-NG", { notation: "compact" }).format(v)}`} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                        formatter={(v: number, n: string) => n === "Occupancy" ? `${Number(v).toFixed(1)}%` : `₦${Number(v).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`} />
                      <Bar yAxisId="occ" dataKey="occ" name="Occupancy" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                      <Line yAxisId="rev" dataKey="revpar" name="RevPAR" stroke="var(--info)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Bars show occupancy. The line shows RevPAR. See Reports for definitions and the full table.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
