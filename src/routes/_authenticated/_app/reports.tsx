import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
    if (property && !range.to) { const to = addDays(property.business_date, -1); setRange({ from: addDays(to, -29), to }); }
  }, [property, range.to]);
  const kpi = useKpis(range.from, range.to, ops);
  const revenue = useReport<RevenueRow>("report_revenue_by_charge_code", { p_from: range.from, p_to: range.to }, fin && !!range.from);
  const balances = useReport<BalanceRow>("report_outstanding_balances", {}, fin);
  const payments = useReport<PaymentRow>("report_payments", { p_from: range.from, p_to: range.to }, fin && !!range.from);
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
      <Tabs defaultValue="kpi">
        <TabsList className="mb-3">
          <TabsTrigger value="kpi">Daily KPIs</TabsTrigger>
          {fin && <TabsTrigger value="revenue">Revenue by charge code</TabsTrigger>}
          {fin && <TabsTrigger value="balances">Outstanding balances</TabsTrigger>}
          {fin && <TabsTrigger value="payments">Payments</TabsTrigger>}
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
                  <TableCell className="tabular">{formatDay(r.business_date)}</TableCell>
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
      </Tabs>
      <DefinitionsBox />
    </div>
  );
}
