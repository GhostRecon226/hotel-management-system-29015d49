import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Info, MoreHorizontal } from "lucide-react";
import {
  movableRow, PostChargeDialog, RecordPaymentDialog, ReopenDialog, ReverseDialog, SplitFolioDialog, TransferDialog,
  useFolio, useFolioAccess, useFolioMutation, useFolioTransactions, useReservationFolios, type FolioTx,
} from "@/lib/folios";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Money, formatAmount } from "@/components/ui/money";
import { EmptyState, LoadingState, TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_app/folios/$id")({ component: FolioPage });

const KIND: Record<string, string> = { charge: "Charge", payment: "Payment", reversal: "Reversal", transfer: "Transfer" };

function FolioPage() {
  const { id } = Route.useParams();
  const { data: folio, isLoading } = useFolio(id);
  const { data: rows = [], isLoading: rowsLoading } = useFolioTransactions(id);
  const { data: siblings = [] } = useReservationFolios(folio?.reservation_id);
  const perm = useFolioAccess();
  const close = useFolioMutation("close_folio", "Folio closed.");
  const [dialog, setDialog] = useState<null | "charge" | "payment" | "split" | "transfer" | "reopen">(null);
  const [transferRow, setTransferRow] = useState<string | null>(null);
  const [reverse, setReverse] = useState<FolioTx | null>(null);

  if (isLoading) return <LoadingState label="Loading folio…" />;
  if (!folio) return <EmptyState title="Folio not found" />;
  const open = folio.status === "open";
  const cur = folio.currency;
  const balance = Number(folio.balance);
  const canReverse = (r: FolioTx) => !r.is_reversed && !r.is_transferred
    && (r.kind === "charge" || r.kind === "payment" || (r.kind === "transfer" && movableRow(r, rows) && Number(r.total) > -Infinity && r.original_id !== null && !rows.some((x) => x.id === r.original_id)));

  return (
    <div>
      <Link to="/reservations/$id" params={{ id: folio.reservation_id }} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Booking {folio.reservation_number}
      </Link>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">{folio.number} · {folio.label}
          {open ? <Badge variant="info">Open</Badge> : <Badge variant="neutral">Closed</Badge>}</span>}
        description={`${folio.guest_name ?? "Guest"}${folio.room_number ? ` · Room ${folio.room_number}` : ""} · ${formatDay(folio.arrival_date)} → ${formatDay(folio.departure_date)}`}
        actions={<>
          {open && perm.charge && <Button onClick={() => setDialog("charge")}>Post charge</Button>}
          {open && perm.payment && <Button onClick={() => setDialog("payment")}>Record payment</Button>}
          {open && perm.charge && <Button variant="outline" onClick={() => setDialog("split")}>Split folio</Button>}
          {open && perm.charge && <Button variant="outline" onClick={() => { setTransferRow(null); setDialog("transfer"); }}>Transfer</Button>}
          {open && perm.payment && <Button variant="outline" disabled={close.isPending} onClick={() => close.mutate({ p_id: folio.folio_id })}>Close</Button>}
          {!open && perm.reopen && <Button variant="outline" onClick={() => setDialog("reopen")}>Reopen</Button>}
        </>} />

      <p className="mb-4 flex items-start gap-2 rounded-md border border-info/30 bg-info-soft p-3 text-[15px] text-info-strong">
        <Info className="mt-0.5 h-5 w-5 shrink-0" /> Payments are taken outside the system and recorded here. Nothing is charged to a card from this screen.
      </p>

      {siblings.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {siblings.map((s) => (
            <Link key={s.folio_id} to="/folios/$id" params={{ id: s.folio_id }}
              className={cn("inline-flex h-11 items-center gap-2 rounded-md border px-3 text-[15px]", s.folio_id === id ? "border-primary bg-primary-soft text-primary-strong" : "hover:bg-muted")}>
              {s.number} · {s.label} <span className="tabular text-muted-foreground">{formatAmount(s.balance, s.currency)}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">Charges</p><Money amount={folio.total_debits} currency={cur} className="text-left text-xl font-semibold" /></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-sm text-muted-foreground">Payments and credits</p><Money amount={folio.total_credits} currency={cur} className="text-left text-xl font-semibold" /></CardContent></Card>
        <Card className={cn(balance > 0 && "border-warning/50", balance < 0 && "border-info/50")}><CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{balance > 0 ? "Balance due" : balance < 0 ? "In credit" : "Balance"}</p>
          <span className="block text-xl font-semibold tabular">{formatAmount(Math.abs(balance), cur)}</span>
        </CardContent></Card>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead>
          <TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="w-12" />
        </TableRow></TableHeader>
        <TableBody>
          {rowsLoading && <TableSkeletonRows cols={6} />}
          {!rowsLoading && rows.length === 0 && <TableStateRow colSpan={6} title="No transactions yet" description="Post a charge or record a payment to start." />}
          {rows.map((r) => {
            const total = Number(r.total);
            const greyed = r.is_reversed || r.is_transferred || r.kind === "reversal" || (r.kind === "transfer" && total * (rows.some((x) => x.id === r.original_id) ? 1 : 1) !== 0 && rows.some((x) => x.id === r.original_id));
            const actions = open ? [
              perm.reverse && canReverse(r) && <DropdownMenuItem key="r" className="h-10" onClick={() => setReverse(r)}>Reverse</DropdownMenuItem>,
              perm.charge && movableRow(r, rows) && <DropdownMenuItem key="t" className="h-10" onClick={() => { setTransferRow(r.id); setDialog("transfer"); }}>Transfer to another folio</DropdownMenuItem>,
            ].filter(Boolean) : [];
            return (
              <TableRow key={r.id} className={cn(greyed && "text-muted-foreground opacity-60")}>
                <TableCell className="tabular">{formatDay(r.business_date)}<span className="block text-xs text-muted-foreground">{formatDateTime(r.posted_at)}</span></TableCell>
                <TableCell>
                  <span className={cn(r.is_reversed && "line-through")}>{r.description}</span>
                  {r.is_deposit && <Badge variant="info" className="ml-2">Deposit</Badge>}
                  {r.is_reversed && <Badge variant="neutral" className="ml-2">Reversed</Badge>}
                  {r.is_transferred && <Badge variant="neutral" className="ml-2">Moved</Badge>}
                  <span className="block text-sm text-muted-foreground">
                    {[r.charge_code_name ?? r.payment_method_name, r.reference, r.posted_by_name].filter(Boolean).join(" · ")}
                    {r.currency !== cur && ` · ${formatAmount(Math.abs(r.amount), r.currency)} at ${Number(r.fx_rate)}`}
                  </span>
                  {(r.tax_lines ?? []).length > 0 && (
                    <span className="block text-sm text-muted-foreground">
                      Net {formatAmount(r.base_amount, cur)} · {(r.tax_lines ?? []).map((l) => `${l.name} ${formatAmount(l.amount, cur)}`).join(" · ")}
                    </span>
                  )}
                </TableCell>
                <TableCell>{KIND[r.kind] ?? r.kind}</TableCell>
                <TableCell>{total > 0 ? <Money amount={total} currency={cur} /> : null}</TableCell>
                <TableCell>{total < 0 ? <Money amount={-total} currency={cur} /> : null}</TableCell>
                <TableCell>
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Row actions"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <PostChargeDialog folio={folio} open={dialog === "charge"} onOpenChange={(o) => !o && setDialog(null)} />
      <RecordPaymentDialog folio={folio} open={dialog === "payment"} onOpenChange={(o) => !o && setDialog(null)} />
      <SplitFolioDialog folio={folio} rows={rows} open={dialog === "split"} onOpenChange={(o) => !o && setDialog(null)} />
      <TransferDialog folio={folio} rows={rows} initial={transferRow} open={dialog === "transfer"} onOpenChange={(o) => !o && setDialog(null)} />
      <ReopenDialog folio={folio} open={dialog === "reopen"} onOpenChange={(o) => !o && setDialog(null)} />
      <ReverseDialog row={reverse} currency={cur} onOpenChange={(o) => !o && setReverse(null)} />
    </div>
  );
}
