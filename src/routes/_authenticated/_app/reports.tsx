import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, Download, Gauge, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { callRpc } from "@/lib/setup";
import { FilledStat, StatTile } from "@/components/stats";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { exportCsv, type ExportKind } from "@/lib/exports.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CancelRow { bookings: number; cancelled: number; no_shows: number; cancellation_rate: number | null; no_show_rate: number | null }
interface LosRow { stays: number; total_nights: number; average_nights: number | null }
interface GuestBalanceRow { guest_id: string | null; guest_name: string | null; folios: number; currency: string; balance: number }
import { useAccess } from "@/lib/access";
import { NoAccess } from "@/lib/setup";
import { formatDay } from "@/lib/reservations";
import { addDays, downloadCsv, formatPercent, useKpis, useReport } from "@/lib/reports";
import { DefinitionsBox } from "@/components/definitions-box";
import { FilterBar, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Money } from "@/components/ui/money";
import { TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Hotel Desk" },
      { name: "description", content: "Occupancy, ADR, RevPAR, revenue by charge code, outstanding balances and payments." },
      { property: "og:title", content: "Reports — Hotel Desk" },
      { property: "og:description", content: "Occupancy, ADR, RevPAR, revenue by charge code, outstanding balances and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

interface RevenueRow { charge_code: string; name: string; category: string; net: number; tax: number; gross: number }
interface BalanceRow { folio_id: string; folio_number: string; label: string; reservation_id: string; reservation_number: string; guest_name: string | null; room_number: string | null; reservation_status: string; folio_status: string; departure_date: string; currency: string; balance: number }
interface PaymentRow { business_date: string; method: string; kind: string; payments: number; refunds: number; net: number; count: number }

function Reports() {
  const { property, can, canAny } = useAccess();
  const ops = canAny(["rpt.operations.view", "rpt.finance.view"]);
  const fin = can("rpt.finance.view");
  const [range, setRange] = useState({ from: "", to: "" });
  useEffect(() => {
    // Default: the last 30 days up to today, so today's payments and revenue show. Daily KPIs exist only for closed dates.
    if (property && !range.to) { const to = property.business_date; setRange({ from: addDays(to, -29), to }); }
  }, [property, range.to]);
  const kpi = useKpis(range.from, range.to, ops);
  // Period totals from the database (kpi_summary), same definitions as the daily rows.
  const period = useQuery({
    queryKey: ["kpi-summary", property?.id, range.from, range.to], enabled: ops && !!property && !!range.from && !!range.to,
    queryFn: () => callRpc<{ occupancy: string | null; adr: string | null; revpar: string | null; rooms_sold: number; days: number }>("kpi_summary", { p_property_id: property!.id, p_from: range.from, p_to: range.to }),
  });
  const revenue = useReport<RevenueRow>("report_revenue_by_charge_code", { p_from: range.from, p_to: range.to }, fin && !!range.from);
  const balances = useReport<BalanceRow>("report_outstanding_balances", {}, fin);
  const payments = useReport<PaymentRow>("report_payments", { p_from: range.from, p_to: range.to }, fin && !!range.from);
  const cancel = useReport<CancelRow>("report_cancellation_rate", { p_from: range.from, p_to: range.to }, ops && !!range.from);
  const los = useReport<LosRow>("report_length_of_stay", { p_from: range.from, p_to: range.to }, ops && !!range.from);
  const byGuest = useReport<GuestBalanceRow>("report_balances_by_guest", {}, fin);
  const canExport = can("rpt.export");
  const runExport = useServerFn(exportCsv);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  async function doExport(kind: ExportKind) {
    if (!property) return;
    setExporting(kind);
    try {
      const r = await runExport({ data: { kind, propertyId: property.id, from: range.from, to: range.to } });
      if (r.count === 0) { toast.info("Nothing to export in this range."); return; }
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = r.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${r.count} rows.`);
    } catch (e) { toast.error(errorMessage(e)); } finally { setExporting(null); }
  }
  if (!ops) return <NoAccess />;
  const cur = property?.base_currency ?? "NGN";
  const k = kpi.data ?? [];

  const exportKpi = () => downloadCsv(`kpi_${range.from}_${range.to}.csv`,
    ["Date", "Rooms available", "Rooms sold", "Occupancy", "ADR", "RevPAR", "Room revenue", "Total revenue", "Arrivals", "Departures", "No-shows", "Cancellations"],
    k.map((r) => [r.business_date, r.rooms_available, r.rooms_sold, r.occupancy, r.adr, r.revpar, r.room_revenue, r.total_revenue, r.arrivals, r.departures, r.no_shows, r.cancellations]));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Figures come from the closed business dates and the ledger." />
      <FilterBar>
        <div className="flex items-center gap-2"><Label htmlFor="r-from">From</Label><Input id="r-from" type="date" className="w-44" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Label htmlFor="r-to">To</Label><Input id="r-to" type="date" className="w-44" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </FilterBar>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <FilledStat icon={Gauge} label="Occupancy in this period" value={formatPercent(period.data?.occupancy == null ? null : Number(period.data.occupancy))}
          sub={`${formatDay(range.from)} to ${formatDay(range.to)}`} />
        <StatTile icon={Wallet} tone="accent" label="ADR" value={<Money amount={period.data?.adr ?? null} currency={cur} className="text-left" />} sub="Room revenue per room sold" />
        <StatTile icon={Wallet} tone="accent" label="RevPAR" value={<Money amount={period.data?.revpar ?? null} currency={cur} className="text-left" />} sub="Room revenue per room available" />
        <StatTile icon={BedDouble} tone="info" label="Rooms sold" value={period.data?.rooms_sold ?? "—"} sub="Nights stayed in this period" />
      </div>
      <Tabs defaultValue="kpi">
        <TabsList className="mb-3">
          <TabsTrigger value="kpi">Daily KPIs</TabsTrigger>
          {fin && <TabsTrigger value="revenue">Revenue by charge code</TabsTrigger>}
          {fin && <TabsTrigger value="balances">Outstanding balances</TabsTrigger>}
          {fin && <TabsTrigger value="payments">Payments</TabsTrigger>}
          <TabsTrigger value="stays">Cancellations and stay length</TabsTrigger>
          {fin && <TabsTrigger value="byguest">Balances by guest</TabsTrigger>}
          {canExport && <TabsTrigger value="export">Export</TabsTrigger>}
        </TabsList>

        <TabsContent value="kpi">
          <div className="mb-3 flex justify-end"><Button variant="outline" disabled={k.length === 0} onClick={exportKpi}><Download className="h-4 w-4" /> Download CSV</Button></div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Occupancy</TableHead><TableHead className="text-right">ADR</TableHead><TableHead className="text-right">RevPAR</TableHead>
              <TableHead className="text-right">Room revenue</TableHead><TableHead className="text-right">Total revenue</TableHead>
              <TableHead className="text-right">Arr.</TableHead><TableHead className="text-right">Dep.</TableHead><TableHead className="text-right">No-shows</TableHead><TableHead className="text-right">Cancelled</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {kpi.isLoading && <TableSkeletonRows cols={12} />}
              {!kpi.isLoading && k.length === 0 && <TableStateRow colSpan={12} title="No closed dates in this range" description="Figures are saved at each business date roll." />}
              {k.map((r) => (
                <TableRow key={r.business_date}>
                  <TableCell className="whitespace-nowrap tabular">{formatDay(r.business_date)}</TableCell>
                  <TableCell className="text-right tabular">{r.rooms_available}</TableCell>
                  <TableCell className="text-right tabular">{r.rooms_sold}</TableCell>
                  <TableCell className="text-right tabular">{formatPercent(r.occupancy)}</TableCell>
                  <TableCell><Money amount={r.adr} currency={cur} /></TableCell>
                  <TableCell><Money amount={r.revpar} currency={cur} /></TableCell>
                  <TableCell><Money amount={r.room_revenue} currency={cur} /></TableCell>
                  <TableCell><Money amount={r.total_revenue} currency={cur} /></TableCell>
                  <TableCell className="text-right tabular">{r.arrivals}</TableCell>
                  <TableCell className="text-right tabular">{r.departures}</TableCell>
                  <TableCell className="text-right tabular">{r.no_shows}</TableCell>
                  <TableCell className="text-right tabular">{r.cancellations}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {fin && (
          <TabsContent value="revenue">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Charge code</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Before tax</TableHead>
                <TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {revenue.isLoading && <TableSkeletonRows cols={5} />}
                {!revenue.isLoading && (revenue.data ?? []).length === 0 && <TableStateRow colSpan={5} title="No revenue in this range" />}
                {(revenue.data ?? []).map((r) => (
                  <TableRow key={r.charge_code}>
                    <TableCell className="font-medium">{r.name}<span className="block text-sm text-muted-foreground">{r.charge_code}</span></TableCell>
                    <TableCell className="capitalize">{r.category}</TableCell>
                    <TableCell><Money amount={r.net} currency={cur} /></TableCell>
                    <TableCell><Money amount={r.tax} currency={cur} /></TableCell>
                    <TableCell><Money amount={r.gross} currency={cur} className="font-semibold" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        )}

        {fin && (
          <TabsContent value="balances">
            <p className="mb-3 text-sm text-muted-foreground">Every folio with a balance today. Positive means the guest owes; negative means the hotel owes the guest.</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead>Folio</TableHead><TableHead>Room</TableHead><TableHead>Departure</TableHead>
                <TableHead>Booking status</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {balances.isLoading && <TableSkeletonRows cols={6} />}
                {!balances.isLoading && (balances.data ?? []).length === 0 && <TableStateRow colSpan={6} title="No outstanding balances" />}
                {(balances.data ?? []).map((b) => (
                  <TableRow key={b.folio_id}>
                    <TableCell>{b.guest_name ?? "Guest"}<span className="block text-sm text-muted-foreground">{b.reservation_number}</span></TableCell>
                    <TableCell><Link to="/folios/$id" params={{ id: b.folio_id }} className="text-primary-strong hover:underline">{b.folio_number}</Link><span className="block text-sm text-muted-foreground">{b.label} · {b.folio_status}</span></TableCell>
                    <TableCell className="tabular">{b.room_number ?? "—"}</TableCell>
                    <TableCell className="tabular">{formatDay(b.departure_date)}</TableCell>
                    <TableCell className="capitalize">{b.reservation_status.replace("_", " ")}</TableCell>
                    <TableCell><Money amount={b.balance} currency={b.currency} className="font-semibold" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        )}

        {fin && (
          <TabsContent value="payments">
            <p className="mb-3 text-sm text-muted-foreground">Payments recorded in the system. Payments are taken outside the system.</p>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Received</TableHead><TableHead className="text-right">Refunded</TableHead><TableHead className="text-right">Net</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payments.isLoading && <TableSkeletonRows cols={6} />}
                {!payments.isLoading && (payments.data ?? []).length === 0 && <TableStateRow colSpan={6} title="No payments in this range" />}
                {(payments.data ?? []).map((p) => (
                  <TableRow key={`${p.business_date}-${p.method}`}>
                    <TableCell className="tabular">{formatDay(p.business_date)}</TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-right tabular">{p.count}</TableCell>
                    <TableCell><Money amount={p.payments} currency={cur} /></TableCell>
                    <TableCell><Money amount={p.refunds} currency={cur} /></TableCell>
                    <TableCell><Money amount={p.net} currency={cur} className="font-semibold" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        )}
        <TabsContent value="stays">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Cancellation rate</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-3xl font-semibold tabular">{formatPercent(cancel.data?.[0]?.cancellation_rate ?? null)}</p>
                <p className="text-muted-foreground">{cancel.data?.[0]?.cancelled ?? 0} cancelled of {cancel.data?.[0]?.bookings ?? 0} bookings arriving in this range. No-shows: {cancel.data?.[0]?.no_shows ?? 0} ({formatPercent(cancel.data?.[0]?.no_show_rate ?? null)}).</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Average length of stay</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-3xl font-semibold tabular">{los.data?.[0]?.average_nights != null ? `${Number(los.data[0].average_nights).toFixed(2)} nights` : "—"}</p>
                <p className="text-muted-foreground">{los.data?.[0]?.stays ?? 0} checked-in stays, {los.data?.[0]?.total_nights ?? 0} nights booked.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {fin && (
          <TabsContent value="byguest">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Guest</TableHead><TableHead className="text-right">Folios</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {byGuest.isLoading && <TableSkeletonRows cols={3} />}
                {!byGuest.isLoading && (byGuest.data ?? []).length === 0 && <TableStateRow colSpan={3} title="No outstanding balances" />}
                {(byGuest.data ?? []).map((g) => (
                  <TableRow key={`${g.guest_id}-${g.currency}`}>
                    <TableCell>{g.guest_id ? <Link to="/guests/$id" params={{ id: g.guest_id }} className="text-primary-strong hover:underline">{g.guest_name ?? "Guest"}</Link> : "No guest"}</TableCell>
                    <TableCell className="text-right tabular">{g.folios}</TableCell>
                    <TableCell><Money amount={g.balance} currency={g.currency} className="font-semibold" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        )}

        {canExport && (
          <TabsContent value="export">
            <Card>
              <CardHeader><CardTitle>Export to CSV</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">Uses the date range above. Bookings and guests go by arrival date; transactions by business date. Every export is recorded in the audit log.</p>
                <div className="flex flex-wrap gap-2">
                  {(["reservations", "transactions", "guests"] as ExportKind[]).map((k) => (
                    <Button key={k} variant="outline" disabled={!range.from || exporting !== null} onClick={() => doExport(k)}>
                      <Download className="h-4 w-4" /> {k === "reservations" ? "Bookings" : k === "transactions" ? "Folio transactions" : "Guests"}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      <DefinitionsBox />
    </div>
  );
}
