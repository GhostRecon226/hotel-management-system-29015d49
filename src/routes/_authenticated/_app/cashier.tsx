import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccess } from "@/lib/access";
import { Field, FormDialog, NoAccess, SectionHeader } from "@/lib/setup";
import { formatDateTime, formatDay } from "@/lib/reservations";
import {
  SHIFT_PERMS, ShiftStatusBadge, useShift, useShiftAction, useShifts, type ShiftRow, type ShiftSummary,
} from "@/lib/cashier";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Money } from "@/components/ui/money";
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
  const shifts = useShifts(filter === "all" ? null : filter);
  const mineAny = useShifts("open");
  const myOpen = (mineAny.data ?? []).find((s) => s.cashier_id === ctx.user_id);
  const open = useShiftAction<string>("open_cashier_shift", "Shift opened.");
  const mySummary = useShift(myOpen?.id ?? null);
  if (!canAny(SHIFT_PERMS)) return <NoAccess />;
  const currency = property?.base_currency ?? "NGN";

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
                {mySummary.data && <LinesTable shift={mySummary.data} currency={currency} />}
              </>
            )}
          </CardContent>
        </Card>
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
  const ready = shift.lines.every((l) => counts[l.payment_method_id] !== undefined && counts[l.payment_method_id] !== "");
  return (
    <FormDialog open onOpenChange={(o) => !o && onClose()} title="Close your shift" busy={close.isPending} submitLabel="Close shift" submitDisabled={!ready}
      onSubmit={() => close.mutate({
        p_shift: shift.id, p_note: note,
        p_counts: shift.lines.map((l) => ({ payment_method_id: l.payment_method_id, counted: Number(counts[l.payment_method_id] ?? 0) })),
      })}>
      <p className="text-sm text-muted-foreground">Count what you hold for each payment method, in {currency}. If it differs from what the system expects, add a note.</p>
      {shift.lines.map((l) => (
        <Field key={l.payment_method_id} label={l.method_name} htmlFor={`count-${l.payment_method_id}`}>
          <Input id={`count-${l.payment_method_id}`} inputMode="decimal" value={counts[l.payment_method_id] ?? ""}
            onChange={(e) => setCounts({ ...counts, [l.payment_method_id]: e.target.value })} />
        </Field>
      ))}
      <Field label="Note" htmlFor="close-note" hint="Needed when the count differs from what the system expects.">
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
