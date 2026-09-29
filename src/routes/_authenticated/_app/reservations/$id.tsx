import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useAccess } from "@/lib/access";
import { callRpc, Field, FormDialog } from "@/lib/setup";
import { fullName, useGuestSearch } from "@/lib/guests";
import {
  describeEvent, formatDateTime, formatDay, GUARANTEES, nightsBetween, ResStatusBadge, SOURCES, useReservation, useResMutation,
  type ReservationDetail,
} from "@/lib/reservations";
import { formFromReservation, ReservationForm } from "@/components/reservation-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Money, formatAmount } from "@/components/ui/money";
import { EmptyState, LoadingState, TableStateRow } from "@/components/ui/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/reservations/$id")({ component: ReservationDetailPage });

type Dialog = null | "cancel" | "noshow" | "reinstate" | "assign" | "guests";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b py-3 text-[15px] last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 whitespace-pre-wrap">{children || "—"}</dd>
    </div>
  );
}

function policyFee(type: string, value: number, nights: { rate_amount: number }[]) {
  const total = nights.reduce((s, n) => s + Number(n.rate_amount), 0);
  if (type === "nights") return nights.slice(0, Math.ceil(value)).reduce((s, n) => s + Number(n.rate_amount), 0);
  if (type === "percent") return Math.round(total * value) / 100;
  if (type === "amount") return Number(value);
  return 0;
}

function ReservationDetailPage() {
  const { id } = Route.useParams();
  const { can } = useAccess();
  const { data, isLoading, error } = useReservation(id);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const confirm = useResMutation("confirm_reservation", "Booking confirmed.");
  const unassign = useResMutation("unassign_room", "Room removed.");

  if (isLoading) return <LoadingState label="Loading booking…" />;
  if (error || !data) return <EmptyState title="Booking not found" action={<Button variant="outline" asChild><Link to="/reservations">All bookings</Link></Button>} />;

  const r = data.reservation;
  const primary = data.guests.find((g) => g.is_primary) ?? data.guests[0];
  const open = r.status === "tentative" || r.status === "confirmed";
  const nights = nightsBetween(r.arrival_date, r.departure_date);

  if (editing) {
    return (
      <div>
        <PageHeader title={`Change ${r.number}`} description={primary ? fullName(primary) : undefined} />
        <ReservationForm mode="edit" reservationId={r.id} initial={formFromReservation(r, primary ? fullName(primary) : "")}
          onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div>
      <Link to="/reservations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>
      <PageHeader
        title={<span className="inline-flex flex-wrap items-center gap-3">{r.number} <ResStatusBadge status={r.status} holdUntil={r.hold_until} /></span>}
        description={`${primary ? fullName(primary) : ""} · ${formatDay(r.arrival_date)} → ${formatDay(r.departure_date)} · ${nights} night${nights === 1 ? "" : "s"}`}
        actions={<>
          {can("fin.folio.view") && r.status !== "cancelled" && r.status !== "no_show" &&
            <Button variant="outline" disabled={openFolio.isPending} onClick={() => openFolio.mutate(r.id)}>Folio</Button>}
          {open && can("res.edit") && <Button variant="outline" onClick={() => setEditing(true)}>Change</Button>}
          {r.status === "tentative" && can("res.edit") && <Button disabled={confirm.isPending} onClick={() => confirm.mutate({ p_id: r.id })}>Confirm</Button>}
          {open && can("res.noshow") && <Button variant="outline" onClick={() => setDialog("noshow")}>No-show</Button>}
          {open && can("res.cancel") && <Button variant="destructive" onClick={() => setDialog("cancel")}>Cancel booking</Button>}
          {(r.status === "cancelled" || r.status === "no_show") && can("res.edit") && <Button onClick={() => setDialog("reinstate")}>Reinstate</Button>}
        </>} />

      {r.status_reason && (r.status === "cancelled" || r.status === "no_show") && (
        <p className="mb-4 rounded-md border border-info/30 bg-info-soft p-3 text-[15px] text-info-strong">
          Reason: {r.status_reason}
          {r.cancellation_fee !== null && <> · Cancellation fee {formatAmount(r.cancellation_fee, r.currency)}{r.fee_waived && " (waived)"}</>}
          {r.no_show_fee !== null && <> · No-show fee {formatAmount(r.no_show_fee, r.currency)}{r.fee_waived && " (waived)"}</>}
        </p>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Stat label="Room">{data.room ? <span className="font-semibold">{data.room.room_number}</span> : <span className="text-muted-foreground">Not assigned</span>}
          {open && can("res.edit") && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDialog("assign")}>{data.room ? "Change" : "Assign"}</Button>
              {data.room && <Button size="sm" variant="ghost" disabled={unassign.isPending} onClick={() => unassign.mutate({ p_id: r.id })}>Remove</Button>}
            </div>
          )}
        </Stat>
        <Stat label="Room type">{data.room_type.code} — {data.room_type.name}</Stat>
        <Stat label="Total"><Money amount={r.total_amount} currency={r.currency} className="text-left text-lg font-semibold" /></Stat>
        <Stat label="Deposit required"><Money amount={r.deposit_required} currency={r.currency} className="text-left text-lg font-semibold" /></Stat>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="nights">Nights ({data.nights.length})</TabsTrigger>
          <TabsTrigger value="guests">Guests ({data.guests.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="pt-6"><dl>
            <Row label="Main guest">{primary && <Link className="text-primary-strong hover:underline" to="/guests/$id" params={{ id: primary.id }}>{fullName(primary)}</Link>}</Row>
            <Row label="People">{`${r.adults} adult${r.adults === 1 ? "" : "s"}, ${r.children} child${r.children === 1 ? "" : "ren"}`}</Row>
            <Row label="Rate plan">{`${data.rate_plan.code} — ${data.rate_plan.name}`}</Row>
            <Row label="Rate override">{r.rate_override !== null ? `${formatAmount(r.rate_override, r.currency)} a night — ${r.override_reason ?? ""}` : "No"}</Row>
            <Row label="Source">{SOURCES[r.source]}</Row>
            <Row label="Company">{r.company_name}</Row>
            <Row label="Group">{data.group?.name}</Row>
            <Row label="Guarantee">{GUARANTEES[r.guarantee]}</Row>
            {r.status === "tentative" && <Row label="Held until">{formatDateTime(r.hold_until)}</Row>}
            <Row label="Special requests">{r.special_requests}</Row>
            <Row label="Notes">{r.notes}</Row>
            <Row label="Booked">{formatDateTime(r.created_at)}</Row>
          </dl></CardContent></Card>
        </TabsContent>

        <TabsContent value="nights">
          <Table>
            <TableHeader><TableRow><TableHead>Night</TableHead><TableHead>Room</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.nights.map((n) => (
                <TableRow key={n.stay_date}>
                  <TableCell className="tabular">{formatDay(n.stay_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  <TableCell>{n.room_id ? data.room?.room_number ?? "Assigned" : "—"}</TableCell>
                  <TableCell><Money amount={n.rate_amount} currency={r.currency} /></TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold hover:bg-transparent">
                <TableCell colSpan={2}>Total (before tax)</TableCell>
                <TableCell><Money amount={r.total_amount} currency={r.currency} /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="guests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Guests on this booking</CardTitle>
              {can("res.edit") && r.status !== "cancelled" && r.status !== "no_show" && r.status !== "checked_out" && (
                <Button size="sm" onClick={() => setDialog("guests")}>Change guests</Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {data.guests.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell><Link className="text-primary-strong hover:underline" to="/guests/$id" params={{ id: g.id }}>{fullName(g)}</Link></TableCell>
                      <TableCell>{g.phone}</TableCell><TableCell>{g.email}</TableCell>
                      <TableCell>{g.is_primary && <Badge variant="info">Main guest</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardContent className="pt-6">
            {data.history.length === 0 ? <EmptyState title="No history yet" /> : (
              <ol className="space-y-4">
                {data.history.map((e) => {
                  const d = describeEvent(e);
                  return (
                    <li key={e.id} className="border-l-2 border-primary/40 pl-4">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-sm text-muted-foreground">{formatDateTime(e.created_at)}{e.actor && ` · ${e.actor}`}</p>
                      {e.reason && <p className="mt-1 text-[15px]">Reason: {e.reason}</p>}
                      {d.changes.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{d.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <FeeDialog kind="cancel" open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} data={data} />
      <FeeDialog kind="noshow" open={dialog === "noshow"} onOpenChange={(o) => setDialog(o ? "noshow" : null)} data={data} />
      <ReinstateDialog open={dialog === "reinstate"} onOpenChange={(o) => setDialog(o ? "reinstate" : null)} id={r.id} />
      <AssignDialog open={dialog === "assign"} onOpenChange={(o) => setDialog(o ? "assign" : null)} id={r.id} current={data.room?.id} />
      <GuestsDialog open={dialog === "guests"} onOpenChange={(o) => setDialog(o ? "guests" : null)} data={data} />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><div className="mt-1 text-[15px]">{children}</div></CardContent></Card>;
}

function FeeDialog({ kind, open, onOpenChange, data }: { kind: "cancel" | "noshow"; open: boolean; onOpenChange: (o: boolean) => void; data: ReservationDetail }) {
  const [f, setF] = useState({ reason: "", waive: false, waive_reason: "" });
  const m = useResMutation<{ fee: number; charged: number; currency: string; waived: boolean }>(
    kind === "cancel" ? "cancel_reservation" : "mark_no_show",
    (d) => `${kind === "cancel" ? "Booking cancelled" : "Marked as no-show"}. Fee: ${formatAmount(d.charged, d.currency)}${d.waived ? " (waived)" : ""}.`,
  );
  const rp = data.rate_plan;
  const fee = kind === "cancel"
    ? policyFee(rp.cancellation_policy_type, Number(rp.cancellation_policy_value), data.nights)
    : policyFee(rp.no_show_policy_type, Number(rp.no_show_policy_value), data.nights);
  return (
    <FormDialog open={open} onOpenChange={(o) => { if (o) setF({ reason: "", waive: false, waive_reason: "" }); onOpenChange(o); }}
      title={kind === "cancel" ? "Cancel booking" : "Mark as no-show"} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: data.reservation.id, p_reason: f.reason, p_waive_fee: f.waive, p_waive_reason: f.waive ? f.waive_reason : null },
        { onSuccess: () => onOpenChange(false) })}>
      <p className="rounded-md bg-muted p-3 text-[15px]">
        Fee under the {rp.name} policy: <strong>{formatAmount(fee, data.reservation.currency)}</strong>. Any assigned room is released.
      </p>
      <Field label="Reason" htmlFor="fee-reason"><Textarea id="fee-reason" required value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
      {fee > 0 && (
        <label className="flex min-h-11 items-center gap-3 text-[15px]">
          <input type="checkbox" className="size-5 accent-primary" checked={f.waive} onChange={(e) => setF({ ...f, waive: e.target.checked })} />
          Waive the fee
        </label>
      )}
      {f.waive && <Field label="Reason for waiving" htmlFor="waive-reason"><Input id="waive-reason" required value={f.waive_reason} onChange={(e) => setF({ ...f, waive_reason: e.target.value })} /></Field>}
    </FormDialog>
  );
}

function ReinstateDialog({ open, onOpenChange, id }: { open: boolean; onOpenChange: (o: boolean) => void; id: string }) {
  const [reason, setReason] = useState("");
  const m = useResMutation("reinstate_reservation", "Booking reinstated.");
  return (
    <FormDialog open={open} onOpenChange={(o) => { if (o) setReason(""); onOpenChange(o); }} title="Reinstate booking" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: id, p_reason: reason }, { onSuccess: () => onOpenChange(false) })}>
      <p className="text-[15px] text-muted-foreground">The booking becomes confirmed again if rooms are still free. Assign a room again afterwards.</p>
      <Field label="Reason" htmlFor="reinstate-reason"><Textarea id="reinstate-reason" required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormDialog>
  );
}

function AssignDialog({ open, onOpenChange, id, current }: { open: boolean; onOpenChange: (o: boolean) => void; id: string; current?: string | undefined }) {
  const rooms = useQuery({
    queryKey: ["reservations", "assignable", id], enabled: open,
    queryFn: () => callRpc<{ id: string; room_number: string; floor: string | null; condition: string; is_occupied: boolean }[]>("get_assignable_rooms", { p_id: id }),
  });
  const m = useResMutation("assign_room", "Room assigned.");
  const COND: Record<string, ["success" | "warning" | "info", string]> = { clean: ["success", "Clean"], inspected: ["success", "Inspected"], dirty: ["warning", "Dirty"] };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Assign a room" busy={m.isPending} onSubmit={() => onOpenChange(false)}>
      {rooms.isLoading ? <LoadingState label="Finding free rooms…" /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Floor</TableHead><TableHead>Condition</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(rooms.data ?? []).length === 0 && <TableStateRow colSpan={4} title="No free rooms of this type" description="All rooms of this type are assigned for these dates." />}
            {(rooms.data ?? []).map((rm) => {
              const c = COND[rm.condition] ?? ["info", rm.condition];
              return (
                <TableRow key={rm.id}>
                  <TableCell className="font-medium">{rm.room_number}</TableCell>
                  <TableCell>{rm.floor}</TableCell>
                  <TableCell><Badge variant={c[0]} dot>{c[1]}</Badge>{rm.is_occupied && <Badge variant="info" className="ml-1">Occupied now</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {rm.id === current ? <Badge variant="neutral">Current</Badge> : (
                      <Button type="button" size="sm" disabled={m.isPending}
                        onClick={() => m.mutate({ p_id: id, p_room_id: rm.id }, { onSuccess: () => onOpenChange(false) })}>Assign</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </FormDialog>
  );
}

function GuestsDialog({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: ReservationDetail }) {
  const init = () => data.guests.map((g) => ({ id: g.id, name: fullName(g) }));
  const [list, setList] = useState(init);
  const [primary, setPrimary] = useState(data.reservation.guest_id);
  const [q, setQ] = useState("");
  const search = useGuestSearch(q, 6);
  const m = useResMutation("set_reservation_guests", "Guests updated.");
  const max = data.reservation.adults + data.reservation.children;
  return (
    <FormDialog open={open} onOpenChange={(o) => { if (o) { setList(init()); setPrimary(data.reservation.guest_id); setQ(""); } onOpenChange(o); }}
      title="Guests on this booking" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: data.reservation.id, p_primary_guest_id: primary, p_guest_ids: list.map((g) => g.id) }, { onSuccess: () => onOpenChange(false) })}>
      <p className="text-sm text-muted-foreground">Up to {max} people. Choose who the main guest is.</p>
      <ul className="divide-y rounded-md border">
        {list.map((g) => (
          <li key={g.id} className="flex min-h-11 items-center justify-between gap-2 px-3 py-2">
            <label className="flex items-center gap-2 text-[15px]">
              <input type="radio" name="primary" className="size-5 accent-primary" checked={primary === g.id} onChange={() => setPrimary(g.id)} />
              {g.name}
            </label>
            {primary !== g.id && <Button type="button" size="sm" variant="ghost" onClick={() => setList(list.filter((x) => x.id !== g.id))}>Remove</Button>}
          </li>
        ))}
      </ul>
      {list.length < max && (
        <div className="space-y-2">
          <Input placeholder="Search guests to add" aria-label="Search guests to add" value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() && (search.data ?? []).filter((g) => !list.some((x) => x.id === g.id)).map((g) => (
            <button type="button" key={g.id} className="flex min-h-11 w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted"
              onClick={() => { setList([...list, { id: g.id, name: fullName(g) }]); setQ(""); }}>
              <span>{fullName(g)}</span><span className="text-sm text-muted-foreground">{g.phone ?? ""}</span>
            </button>
          ))}
        </div>
      )}
    </FormDialog>
  );
}
