import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime, formatDay } from "@/lib/reservations";
import {
  SHIFT_PERMS, ShiftStatusBadge, useShift, useShiftAction, useShifts, type ShiftRow, type ShiftSummary,
} from "@/lib/cashier";
import { FOLIO_PAGE, useFolioList, type FolioSummary } from "@/lib/folios";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Money, formatAmount } from "@/components/ui/money";
import { RoomName } from "@/components/room-name";
import { LoadingState, TableSkeletonRows, TableStateRow } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_app/cashier")({
  head: () => ({
    meta: [
      { title: "Cashier shift — Zikora" },
      { name: "description", content: "Open your shift, count your drawer and close it. Managers review the shifts." },
      { property: "og:title", content: "Cashier shift — Zikora" },
      { property: "og:description", content: "Open your shift, count your drawer and close it. Managers review the shifts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cashier,
});

type Filter = "all" | "open" | "unreconciled";
const FILTERS: Array<[Filter, string]> = [["all", "All shifts"], ["open", "Open"], ["unreconciled", "Needs review"]];

function Cashier() {
  const { property, canAny, can, ctx } = useAccess();
  const [filter, setFilter] = useState<Filter>("all");
  const [floatText, setFloatText] = useState("0");
  const [closing, setClosing] = useState<ShiftSummary | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const shifts = useShifts(filter === "all" ? null : filter);
  const allShifts = useShifts(null);
  const folios = useFolioList(can("fin.folio.view") ? property?.id : undefined, "open", FOLIO_PAGE);
  const mineAny = useShifts("open");
  const myOpen = (mineAny.data ?? []).find((s) => s.cashier_id === ctx.user_id);
  const open = useShiftAction<string>("open_cashier_shift", "Shift opened.");
  const mySummary = useShift(myOpen?.id ?? null);
  if (!canAny(SHIFT_PERMS)) return <NoAccess />;
  const currency = property?.base_currency ?? "NGN";
  const toReview = can("fin.shift.reconcile") ? (allShifts.data ?? []).filter((x) => x.status === "closed" && !x.reconciled && Number(x.variance_total ?? 0) !== 0) : [];
  const needle = find.trim().toLowerCase();
  const openFolios = (folios.data ?? [])
    .filter((f) => !needle || [f.guest_name, f.number, f.room_number, f.reservation_number].some((v) => (v ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => Number(Number(b.amount_due) > 0) - Number(Number(a.amount_due) > 0));

  return (
    <div className="space-y-6">
      <PageHeader title="Cashier shift" description="Open your shift before you take payments. Count each payment method when you finish." />

      {can("fin.shift.close") && (
        <Card>
          <CardContent className="pt-6">
            {mineAny.isLoading ? <LoadingState /> : !myOpen ? (
              <>
                <SectionHeader title="Start your shift" description="The float is the cash already in your drawer." />
                <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); open.mutate({ p_property_id: property!.id, p_opening_float: Number(floatText || 0), p_idempotency_key: crypto.randomUUID() }); }}>
                  <Field label={`Opening float (${currency})`} htmlFor="float">
                    <Input id="float" inputMode="decimal" value={floatText} onChange={(e) => setFloatText(e.target.value)} className="w-40" />
                  </Field>
                  <Button type="submit" disabled={open.isPending}>Open shift</Button>
                </form>
              </>
            ) : (
              <>
                <SectionHeader title="Your shift is open" description={`Opened ${formatDateTime(myOpen.opened_at)}. These are the amounts you should hold.`}
                  action={<Button onClick={() => mySummary.data && setClosing(mySummary.data)} disabled={!mySummary.data}>Close shift</Button>} />
                {mySummary.data && (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="What you should hold">
                    {mySummary.data.lines.length === 0 && <li className="text-sm text-muted-foreground">No payments in this shift yet.</li>}
                    {mySummary.data.lines.map((l) => (
                      <li key={l.payment_method_id} className="rounded-xl border border-border/70 bg-card p-3.5 shadow-card">
                        <div className="text-sm font-medium text-muted-foreground">{l.method_name} you should hold</div>
                        <div className="mt-0.5 text-2xl font-bold tabular">{formatAmount(l.expected, currency)}</div>
                        {l.method_kind === "cash" && Number(mySummary.data!.opening_float) > 0 && <div className="text-sm text-muted-foreground">Includes the opening float</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {myOpen && can("fin.folio.view") && (
        <Card>
          <CardContent className="pt-6">
            <SectionHeader title="Open folios" description="Guests who are in house or have not settled. Owing folios come first." />
            <Input aria-label="Find a folio" placeholder="Find a guest, room or folio number" value={find} onChange={(e) => setFind(e.target.value)} className="mb-3 max-w-md" />
            {folios.isLoading ? <LoadingState /> : openFolios.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{needle ? "No folios match." : "No open folios."}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {openFolios.slice(0, 8).map((f: FolioSummary) => {
                  const owing = Number(f.amount_due) > 0;
                  return (
                    <li key={f.folio_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0">
                        <span className="font-semibold">{f.guest_name ?? "Guest"}</span>
                        {f.room_number && <span className="text-muted-foreground"> · <RoomName label={f.room_number} className="font-normal" /></span>}
                        <span className="block text-sm text-muted-foreground">{f.number} · out {formatDay(f.departure_date)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {owing ? <><span className="font-semibold tabular">{formatAmount(f.amount_due, f.currency)}</span><Badge variant="warning">Owing</Badge></> : <Badge variant="success">Settled</Badge>}
                        {owing && can("fin.payment.post") && (
                          <Button size="sm" className="pointer-coarse:h-11" asChild>
                            <Link to="/folios/$id" params={{ id: f.folio_id }} search={{ pay: true }} aria-label={`Take payment for ${f.guest_name ?? f.number}`}>Take payment</Link>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="pointer-coarse:h-11" asChild>
                          <Link to="/folios/$id" params={{ id: f.folio_id }} aria-label={`Open folio ${f.number}`}>Open folio</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {openFolios.length > 8 && <p className="mt-3 text-sm text-muted-foreground">Showing 8 of {openFolios.length}. Search to narrow the list, or <Link to="/folios" className="font-medium text-primary-strong hover:underline">see all folios</Link>.</p>}
          </CardContent>
        </Card>
      )}

      {toReview.length > 0 && (
        <section aria-labelledby="cs-review" className="rounded-xl border border-warning/40 bg-warning-soft/60 p-3 sm:p-4">
          <h2 id="cs-review" className="mb-2 text-base font-bold">Needs review <span className="tabular text-muted-foreground">({toReview.length})</span></h2>
          <ul className="grid gap-2">
            {toReview.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg bg-card px-3 py-2.5 shadow-xs">
                <div className="min-w-0">
                  <span className="font-semibold">{x.cashier_name}</span> <span className="text-muted-foreground">· {formatDay(x.business_date)}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-sm">
                    <Badge variant="warning">{Number(x.variance_total) < 0 ? "Short" : "Over"}</Badge>
                    <Money amount={x.variance_total} currency={currency} className="inline" />
                  </span>
                </div>
                <Button size="sm" className="pointer-coarse:h-11" onClick={() => setViewing(x.id)} aria-label={`Review shift of ${x.cashier_name}`}>Reconcile</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardContent className="pt-6">
          <SectionHeader title="Shifts" description={can("fin.shift.reconcile") ? "Every shift at this hotel." : "Your shifts."} />
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter shifts">
            {FILTERS.map(([k, label]) => (
              <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</Button>
            ))}
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Cashier</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Difference</TableHead><TableHead className="w-24" />
            </TableRow></TableHeader>
            <TableBody>
              {shifts.isLoading && <TableSkeletonRows cols={5} />}
              {!shifts.isLoading && (shifts.data ?? []).length === 0 && <TableStateRow colSpan={5} title="No shifts yet" />}
              {(shifts.data ?? []).map((s: ShiftRow) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDay(s.business_date)}<span className="block text-sm text-muted-foreground">{formatDateTime(s.opened_at)}</span></TableCell>
                  <TableCell className="font-medium">{s.cashier_name}</TableCell>
                  <TableCell><ShiftStatusBadge row={s} /></TableCell>
                  <TableCell className="text-right">{s.variance_total == null ? "—" : <Money amount={s.variance_total} currency={currency} />}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setViewing(s.id)} aria-label={`View shift of ${s.cashier_name}`}>View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CloseDialog shift={closing} currency={currency} onClose={() => setClosing(null)} />
      <ViewDialog id={viewing} currency={currency} onClose={() => setViewing(null)} />
    </div>
  );
}

function LinesTable({ shift, currency }: { shift: ShiftSummary; currency: string }) {
  const closed = shift.status === "closed";
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Payment method</TableHead><TableHead className="text-right">Should hold</TableHead>
        {closed && <><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Difference</TableHead></>}
      </TableRow></TableHeader>
      <TableBody>
        {shift.lines.length === 0 && <TableStateRow colSpan={closed ? 4 : 2} title="No payments in this shift" />}
        {shift.lines.map((l) => (
          <TableRow key={l.payment_method_id}>
            <TableCell className="font-medium">{l.method_name}{l.method_kind === "cash" && Number(shift.opening_float) > 0 && <span className="block text-sm font-normal text-muted-foreground">Includes the opening float</span>}</TableCell>
            <TableCell className="text-right"><Money amount={l.expected} currency={currency} /></TableCell>
            {closed && <>
              <TableCell className="text-right">{l.counted == null ? "—" : <Money amount={l.counted} currency={currency} />}</TableCell>
              <TableCell className="text-right">{l.variance == null ? "—" : <Money amount={l.variance} currency={currency} />}</TableCell>
            </>}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CloseDialog({ shift, currency, onClose }: { shift: ShiftSummary | null; currency: string; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const close = useShiftAction("close_cashier_shift", "Shift closed.", () => { setCounts({}); setNote(""); onClose(); });
  if (!shift) return null;
  const typed = (id: string) => counts[id] !== undefined && counts[id] !== "";
  const ready = shift.lines.every((l) => typed(l.payment_method_id));
  // Only a comparison, never arithmetic: the database works out the exact difference when the shift closes.
  const differs = (l: ShiftSummary["lines"][number]) => typed(l.payment_method_id) && Number(counts[l.payment_method_id]) !== Number(l.expected);
  const anyDiffers = shift.lines.some(differs);
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title="Close your shift" busy={close.isPending} submitLabel="Close shift" submitDisabled={!ready || (anyDiffers && !note.trim())}
      onSubmit={() => close.mutate({
        p_shift: shift.id, p_note: note,
        p_counts: shift.lines.map((l) => ({ payment_method_id: l.payment_method_id, counted: Number(counts[l.payment_method_id] ?? 0) })),
      })}>
      <p className="text-sm text-muted-foreground">Count what you hold for each payment method, in {currency}. The system shows what it expects beside each box.</p>
      {shift.lines.map((l) => (
        <Field key={l.payment_method_id} label={l.method_name} htmlFor={`count-${l.payment_method_id}`}
          hint={`Should hold ${formatAmount(l.expected, currency)}${typed(l.payment_method_id) ? (differs(l) ? ". This count differs." : ". Matches.") : ""}`}>
          <Input id={`count-${l.payment_method_id}`} inputMode="decimal" value={counts[l.payment_method_id] ?? ""}
            onChange={(e) => setCounts({ ...counts, [l.payment_method_id]: e.target.value })} />
        </Field>
      ))}
      <Field label="Note" htmlFor="close-note" hint={anyDiffers ? "Needed because a count differs from what the system expects." : "Needed only when a count differs from what the system expects."}>
        <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </Field>
    </FormDialog>
  );
}

function ViewDialog({ id, currency, onClose }: { id: string | null; currency: string; onClose: () => void }) {
  const { can } = useAccess();
  const q = useShift(id);
  const [note, setNote] = useState("");
  const rec = useShiftAction("reconcile_cashier_shift", "Shift reconciled.", () => { setNote(""); onClose(); });
  const s = q.data;
  if (!id) return null;
  const canReconcile = !!s && s.status === "closed" && !s.reconciled_at && can("fin.shift.reconcile");
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title={s ? `Shift of ${s.cashier_name ?? "cashier"}` : "Shift"}
      busy={rec.isPending} submitLabel="Reconcile" submitDisabled={!canReconcile}
      onSubmit={() => rec.mutate({ p_shift: id, p_note: note })}>
      {!s ? <LoadingState /> : (
        <>
          <p className="text-sm text-muted-foreground">
            {formatDay(s.business_date)}. Opened {formatDateTime(s.opened_at)}{s.closed_at ? `, closed ${formatDateTime(s.closed_at)}` : ""}.
          </p>
          <LinesTable shift={s} currency={currency} />
          {s.close_note && <p className="text-sm"><span className="font-medium">Cashier's note:</span> {s.close_note}</p>}
          {s.reconciled_at && <p className="text-sm"><span className="font-medium">Reconciled</span> by {s.reconciled_by_name ?? "a manager"} on {formatDateTime(s.reconciled_at)}.{s.reconcile_note ? ` ${s.reconcile_note}` : ""}</p>}
          {canReconcile && (
            <Field label="Reconcile note" htmlFor="rec-note" hint="Needed when the shift has a difference. You cannot reconcile a shift you closed.">
              <Textarea id="rec-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </Field>
          )}
        </>
      )}
    </FormDialog>
  );
}
