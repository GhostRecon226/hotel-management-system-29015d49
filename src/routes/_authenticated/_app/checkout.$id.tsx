import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess } from "@/lib/setup";
import { formatDateTime, formatDay } from "@/lib/reservations";
import { useCheckOutNight, useCheckoutOutstanding, useReservationFolios } from "@/lib/folios";
import { setLabelHint } from "@/lib/offline/queue";
import { useWaitingFor } from "@/lib/offline/use-queue";
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
  head: () => ({ meta: [{ title: "Check-out · Zikora" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const stay = useCheckoutStay(id);
  const folios = useReservationFolios(id);
  const outstandingQ = useCheckoutOutstanding(id);
  const approvals = useCheckoutApprovals(id);
  const night = useCheckOutNight(id);
  const [dialog, setDialog] = useState<null | "force" | "request" | "undo" | "waive">(null);
  const postNight = useCheckoutAction("post_check_out_charge", "One night posted to the folio.");
  const checkOut = useCheckoutAction("check_out", "Guest checked out. Room marked dirty and sent to housekeeping.");
  const waitingOut = useWaitingFor("check_out", id);
  const who = stay.data;
  useEffect(() => { if (who) setLabelHint("check_out", id, `Check out ${who.room_number}${who.guest_name ? `, ${who.guest_name}` : ""}`); }, [who, id]);

  if (!can("fo.view")) return <NoAccess />;
  if (stay.isLoading) return <LoadingState label="Loading check-out…" />;
  const s = stay.data;
  if (!s) return <EmptyState title="No stay found" description="This booking has not been checked in." />;

  const list = folios.data ?? [];
  // Outstanding comes from the database (checkout_outstanding): owed plus owed back, across folios.
  const outstanding = outstandingQ.data ?? "0";
  const settled = outstandingQ.isSuccess && Number(outstanding) === 0;
  const inHouse = s.status === "in_house";
  const canAct = inHouse && !waitingOut;
  const approved = (approvals.data ?? []).find((a) => a.status === "approved" && !a.is_used);
  const pending = (approvals.data ?? []).find((a) => a.status === "pending");
  const canForce = can("fo.checkout.unsettled");

  return (
    <div>
      <Link to="/front-desk" className="mb-1 inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Front Desk
      </Link>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">Check-out · {s.room_number}
          {inHouse ? <Badge variant="info">In house</Badge> : <Badge variant="neutral">Checked out</Badge>}</span>}
        description={`${s.guest_name ?? "Guest"} · ${s.number} · ${formatDay(s.arrival_date)} → ${formatDay(s.departure_date)}`}
        actions={<>
          {canAct && can("fo.checkout") && settled &&
            <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate({ p_id: id })}>Check out</Button>}
          {canAct && can("fo.checkout") && !settled && approved &&
            <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate({ p_id: id, p_approval_id: approved.id })}>Check out (approved)</Button>}
          {canAct && can("fo.checkout") && !settled && !approved && canForce &&
            <Button variant="destructive" onClick={() => setDialog("force")}>Check out with balance</Button>}
          {canAct && can("fo.checkout") && !settled && !approved && !canForce && !pending &&
            <Button onClick={() => setDialog("request")}>Ask to check out with balance</Button>}
          {!inHouse && s.can_undo && can("fo.checkout.undo") &&
            <Button variant="outline" onClick={() => setDialog("undo")}>Undo check-out</Button>}
        </>} />

      {waitingOut && (
        <Alert className="mb-4">
          <AlertTitle>Check-out is waiting to send</AlertTitle>
          <AlertDescription>It was saved on this device. It goes to the server when the connection returns. If the balance is not zero then, only someone who may check out with a balance can complete it; otherwise it appears under Needs attention.</AlertDescription>
        </Alert>
      )}
      {inHouse && !settled && (
        <Alert variant="filled" className="mb-4 p-5">
          <AlertTitle className="mb-2 text-2xl font-bold tabular">Outstanding {formatAmount(outstanding, s.currency)}</AlertTitle>
          <AlertDescription className="text-on-primary-muted">
            Every folio must be at zero before check-out. Record payments or refunds on the folios below.
            {pending && <> A request to check out with a balance is waiting for approval ({pending.reason}).</>}
            {approved && <> Approved by {approved.decided_by_name ?? "a manager"} for up to {formatAmount(approved.amount, approved.currency)}.</>}
          </AlertDescription>
        </Alert>
      )}
      {inHouse && (night.data?.applies || night.data?.posted) && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle className="font-semibold">Same-day stay: one night is charged</AlertTitle>
          <AlertDescription>
            {night.data.applies
              ? <>The guest checked in today, so one night ({formatAmount(night.data.total, night.data.currency)} with tax) is charged at check-out. It is already in the outstanding amount. Post it now to see it on the folio.</>
              : <>One night for this same-day stay is on the folio.</>}
            <span className="mt-2 flex flex-wrap gap-2">
              {night.data.applies && can("fo.checkout") &&
                <Button size="sm" variant="outline" disabled={postNight.isPending} onClick={() => postNight.mutate({ p_id: id })}>Post it now</Button>}
              {can("res.rate.override") &&
                <Button size="sm" variant="outline" onClick={() => setDialog("waive")}>Waive with a reason</Button>}
            </span>
          </AlertDescription>
        </Alert>
      )}
      {!inHouse && (
        <p className="mb-4 rounded-xl border border-info/25 bg-info-soft px-4 py-2.5 text-sm text-info-strong">
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
      <ReasonDialog open={dialog === "waive"} onOpenChange={(o) => setDialog(o ? "waive" : null)} title="Waive same-day charge"
        note="The one-night charge for leaving on the arrival day is not charged (or is reversed if already posted). The reason is kept in the booking history."
        action="waive_same_day_charge" success="Same-day charge waived." args={(reason) => ({ p_id: id, p_reason: reason })} />
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
