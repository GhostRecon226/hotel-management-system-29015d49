import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { useInvoice } from "@/lib/checkout";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice · Hotel Desk" }] }),
  component: InvoicePage,
});

function InvoicePage() {
  const { id } = Route.useParams();
  const { data: inv, isLoading } = useInvoice(id);
  if (isLoading) return <LoadingState label="Loading invoice…" />;
  if (!inv) return <EmptyState title="Invoice not found" />;
  const h = inv.header;
  const cur = inv.currency;
  // Day totals come from the database; older invoices have none and show no day rows.
  const dayTotals = new Map((h.day_totals ?? []).map((d) => [d.date, d]));

  return (
    <div className="mx-auto max-w-4xl bg-background p-6 text-foreground print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link to="/folios/$id" params={{ id: inv.folio_id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to folio
        </Link>
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">{h.property ?? h.hotel}</h1>
          {h.hotel && h.hotel !== h.property && <p className="text-muted-foreground">{h.hotel}</p>}
          <p className="text-sm text-muted-foreground">{[h.address, h.city, h.country].filter(Boolean).join(", ")}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{inv.kind === "final" ? "Invoice" : "Interim invoice"}</p>
          <p className="tabular">{inv.number}</p>
          <p className="text-sm text-muted-foreground">Issued {formatDateTime(inv.issued_at)}</p>
        </div>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 text-[15px] sm:grid-cols-4">
        <dt className="text-muted-foreground">Guest</dt><dd>{h.guest_name ?? "—"}</dd>
        <dt className="text-muted-foreground">Company</dt><dd>{h.company_name ?? "—"}</dd>
        <dt className="text-muted-foreground">Booking</dt><dd className="tabular">{h.reservation_number}</dd>
        <dt className="text-muted-foreground">Folio</dt><dd className="tabular">{h.folio_number} · {h.folio_label}</dd>
        <dt className="text-muted-foreground">Room</dt><dd>{h.room_number ?? "—"}</dd>
        <dt className="text-muted-foreground">Stay</dt><dd className="tabular">{h.arrival_date && formatDay(h.arrival_date)} – {h.departure_date && formatDay(h.departure_date)}</dd>
        {h.nights != null && <><dt className="text-muted-foreground">Nights</dt><dd className="tabular">{h.nights}</dd></>}
        {h.adults != null && <><dt className="text-muted-foreground">Guests</dt><dd className="tabular">{guestsText(h.adults, h.children ?? 0)}</dd></>}
        {h.checked_in_at && <><dt className="text-muted-foreground">Checked in</dt><dd className="tabular">{formatDateTime(h.checked_in_at)}</dd></>}
      </dl>

      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Description</TableHead>
          <TableHead className="text-right">Net</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Amount</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {inv.lines.map((l, i) => (
            <Fragment key={l.id}>
            <TableRow className={cn((l.is_reversed || l.is_transferred) && "text-muted-foreground")}>
              <TableCell className="tabular">{formatDay(l.date)}</TableCell>
              <TableCell>
                {l.description}
                {l.reference && <span className="block text-xs text-muted-foreground">Receipt {l.reference}</span>}
                {l.tax_lines.length > 0 && <span className="block text-xs text-muted-foreground">{l.tax_lines.map((t) => `${t.name} ${Number(t.percent)}%`).join(" · ")}</span>}
              </TableCell>
              {/* Payments and refunds are money received or returned, not charges: no net or tax column. */}
              {l.kind === "payment" || l.kind === "refund"
                ? <><TableCell className="text-right text-muted-foreground">—</TableCell><TableCell className="text-right text-muted-foreground">—</TableCell></>
                : <><TableCell><Money amount={l.net} currency={cur} /></TableCell><TableCell><Money amount={l.tax} currency={cur} /></TableCell></>}
              <TableCell><Money amount={l.total} currency={cur} /></TableCell>
            </TableRow>
            {dayTotals.has(l.date) && inv.lines[i + 1]?.date !== l.date && (
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={2} className="text-right">Day total {formatDay(l.date)}</TableCell>
                <TableCell><Money amount={dayTotals.get(l.date)!.net} currency={cur} /></TableCell>
                <TableCell><Money amount={dayTotals.get(l.date)!.tax} currency={cur} /></TableCell>
                <TableCell><Money amount={dayTotals.get(l.date)!.total} currency={cur} /></TableCell>
              </TableRow>
            )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {inv.lines.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No charges.</p>}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Tax summary</h2>
          <Table>
            <TableHeader><TableRow><TableHead>Tax</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead></TableRow></TableHeader>
            <TableBody>
              {inv.tax_split.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No tax</TableCell></TableRow>}
              {inv.tax_split.map((t) => (
                <TableRow key={`${t.tax_code}-${t.percent}`}>
                  <TableCell>{t.tax_name}</TableCell>
                  <TableCell className="text-right tabular">{Number(t.percent)}%</TableCell>
                  <TableCell><Money amount={t.taxable_base} currency={cur} /></TableCell>
                  <TableCell><Money amount={t.amount} currency={cur} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <section>
          <dl className="space-y-2 text-[15px]">
            <Total label="Net total" amount={inv.net_total} cur={cur} />
            <Total label="Tax" amount={inv.tax_total} cur={cur} />
            <Total label="Total" amount={inv.gross_total} cur={cur} strong />
            <Total label="Paid" amount={inv.payments_total} cur={cur} />
            <Total label="Balance due" amount={inv.balance} cur={cur} strong />
          </dl>
        </section>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Business date {formatDay(inv.business_date)}. Payments are received outside this system and recorded on the folio.</p>
    </div>
  );
}

function guestsText(adults: number, children: number) {
  const a = `${adults} adult${adults === 1 ? "" : "s"}`;
  return children > 0 ? `${a}, ${children} child${children === 1 ? "" : "ren"}` : a;
}

function Total({ label, amount, cur, strong }: { label: string; amount: number; cur: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between border-b py-1", strong && "text-lg font-semibold")}>
      <dt>{label}</dt><dd><Money amount={amount} currency={cur} /></dd>
    </div>
  );
}
