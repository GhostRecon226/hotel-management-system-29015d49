import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess } from "@/lib/setup";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { useReservationFolios } from "@/lib/folios";
import { useCheckoutAction, useCheckoutApprovals, useCheckoutStay } from "@/lib/checkout";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money, formatAmount } from "@/components/ui/money";
import { EmptyState, LoadingState, TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/checkout/$id")({
  head: () => ({ meta: [{ title: "Check-out · Hotel Desk" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const stay = useCheckoutStay(id);
  const folios = useReservationFolios(id);
  const approvals = useCheckoutApprovals(id);
  const [dialog, setDialog] = useState<null | "force" | "request" | "undo">(null);
  const checkOut = useCheckoutAction("check_out", "Guest checked out. Room marked dirty and sent to housekeeping.");

  if (!can("fo.view")) return <NoAccess />;
  if (stay.isLoading) return <LoadingState label="Loading check-out…" />;
  const s = stay.data;
  if (!s) return <EmptyState title="No stay found" description="This booking has not been checked in." />;

  const list = folios.data ?? [];
  const outstanding = list.reduce((t, f) => t + Math.abs(Number(f.balance)), 0);
  const settled = outstanding === 0;
  const inHouse = s.status === "in_house";
  const approved = (approvals.data ?? []).find((a) => a.status === "approved" && !a.is_used);
  const pending = (approvals.data ?? []).find((a) => a.status === "pending");
  const canForce = can("fo.checkout.unsettled");

  return (
    <div>
      <Link to="/front-desk" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">Check-out · Room {s.room_number}
          {inHouse ? <Badge variant="info">In house</Badge> : <Badge variant="neutral">Checked out</Badge>}</span>}
        description={`${s.guest_name ?? "Guest"} · ${s.number} · ${formatDay(s.arrival_date)} → ${formatDay(s.departure_date)}`}
        actions={<>
          {inHouse && can("fo.checkout") && settled &&
            <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate({ p_id: id })}>Check out</Button>}
          {inHouse && can("fo.checkout") && !settled && approved &&
            <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate({ p_id: id, p_approval_id: approved.id })}>Check out (approved)</Button>}
          {inHouse && can("fo.checkout") && !settled && !approved && canForce &&
            <Button variant="destructive" onClick={() => setDialog("force")}>Check out with balance</Button>}
          {inHouse && can("fo.checkout") && !settled && !approved && !canForce && !pending &&
            <Button onClick={() => setDialog("request")}>Ask to check out with balance</Button>}
          {!inHouse && s.can_undo && can("fo.checkout.undo") &&
            <Button variant="outline" onClick={() => setDialog("undo")}>Undo check-out</Button>}
        </>} />

      {inHouse && !settled && (
        <Alert className="mb-4">
          <AlertTitle>Outstanding {formatAmount(outstanding, s.currency)}</AlertTitle>
          <AlertDescription>
            Every folio must be at zero before check-out. Record payments or refunds on the folios below.
            {pending && <> A request to check out with a balance is waiting for approval ({pending.reason}).</>}
            {approved && <> Approved by {approved.decided_by_name ?? "a manager"} for up to {formatAmount(approved.amount, approved.currency)}.</>}
          </AlertDescription>
        </Alert>
      )}
      {!inHouse && (
        <p className="mb-4 rounded-md border border-info/30 bg-info-soft p-3 text-[15px] text-info-strong">
          Checked out {formatDateTime(s.checked_out_at)}{s.checkout_reason ? ` · Reason: ${s.checkout_reason}` : ""}.
          {s.can_undo ? " This can be undone today." : ""}
        </p>
      )}

      <Table>
        <TableHeader><TableRow>
          <TableHead>Folio</TableHead><TableHead>Guest</TableHead><TableHead>Status</TableHead>
          <TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Balance</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {folios.isLoading && <TableSkeletonRows cols={6} />}
          {!folios.isLoading && list.length === 0 && <TableStateRow colSpan={6} title="No folios" />}
          {list.map((f) => {
            const b = Number(f.balance);
            return (
              <TableRow key={f.folio_id}>
                <TableCell><Link to="/folios/$id" params={{ id: f.folio_id }} className="font-medium text-primary-strong hover:underline">{f.number} · {f.label}</Link></TableCell>
                <TableCell>{f.guest_name ?? "—"}</TableCell>
                <TableCell>{f.status === "open" ? <Badge variant="info">Open</Badge> : <Badge variant="neutral">Closed</Badge>}</TableCell>
                <TableCell><Money amount={f.total_debits} currency={f.currency} /></TableCell>
                <TableCell><Money amount={f.total_credits} currency={f.currency} /></TableCell>
                <TableCell>
                  <span className="flex items-center justify-end gap-2">
                    {b === 0 ? <Badge variant="success">Paid</Badge> : <Badge variant={b > 0 ? "warning" : "info"}>{b > 0 ? "Due" : "Credit"}</Badge>}
                    <Money amount={b} currency={f.currency} className="font-semibold" />
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ReasonDialog open={dialog === "force"} onOpenChange={(o) => setDialog(o ? "force" : null)} title="Check out with a balance"
        note={`${formatAmount(outstanding, s.currency)} is still outstanding. Folios with a balance stay open so they can be settled later.`}
        action="check_out" success="Guest checked out with a balance." args={(reason) => ({ p_id: id, p_reason: reason })} />
      <ReasonDialog open={dialog === "request"} onOpenChange={(o) => setDialog(o ? "request" : null)} title="Ask to check out with a balance"
        note="A manager will be notified. Once approved, come back here to check the guest out."
        action="request_unsettled_checkout" success="Sent for approval. A manager has been notified." withKey
        args={(reason, key) => ({ p_id: id, p_reason: reason, p_idempotency_key: key })} />
      <ReasonDialog open={dialog === "undo"} onOpenChange={(o) => setDialog(o ? "undo" : null)} title="Undo check-out"
        note="The guest goes back in house, the room is occupied again, the turnover task is cancelled and folios closed at check-out reopen."
        action="undo_checkout" success="Check-out undone." args={(reason) => ({ p_id: id, p_reason: reason })} />
    </div>
  );
}

function ReasonDialog({ open, onOpenChange, title, note, action, success, args, withKey }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; note: string; action: string; success: string;
  args: (reason: string, key: string) => Record<string, unknown>; withKey?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [key, setKey] = useState(() => crypto.randomUUID());
  const m = useCheckoutAction(action, success);
  return (
    <FormDialog open={open} onOpenChange={(o) => { if (o) { setReason(""); if (withKey) setKey(crypto.randomUUID()); } onOpenChange(o); }}
      title={title} busy={m.isPending}
      onSubmit={() => m.mutate(args(reason, key), { onSuccess: () => onOpenChange(false) })}>
      <p className="text-[15px] text-muted-foreground">{note}</p>
      <Field label="Reason" htmlFor={`${action}-reason`}><Input id={`${action}-reason`} required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormDialog>
  );
}
