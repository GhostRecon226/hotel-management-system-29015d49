import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog, useSetupList } from "@/lib/setup";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmount } from "@/components/ui/money";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FolioSummary {
  folio_id: string; property_id: string; reservation_id: string; reservation_number: string; number: string; label: string;
  is_main: boolean; status: "open" | "closed"; currency: string; guest_id: string | null; guest_name: string | null;
  arrival_date: string; departure_date: string; reservation_status: string; room_number: string | null; closed_at: string | null;
  total_debits: number; total_credits: number; balance: number;
}
export interface FolioTx {
  id: string; folio_id: string; kind: string; charge_code: string | null; charge_code_name: string | null;
  payment_method_name: string | null; amount: number; currency: string; fx_rate: number; base_amount: number;
  tax_amount: number; total: number; tax_inclusive: boolean; is_deposit: boolean; description: string | null;
  reference: string | null; original_id: string | null; posted_by_name: string | null; posted_at: string; business_date: string;
  is_reversed: boolean; is_transferred: boolean; tax_lines: { name: string; percent: number; amount: number }[] | null;
}

const newKey = () => crypto.randomUUID();

export function useFolio(id: string) {
  return useQuery({
    queryKey: ["folios", "one", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_folio_balances").select("*").eq("folio_id", id).maybeSingle();
      if (error) throw error;
      return data as FolioSummary | null;
    },
  });
}
export function useReservationFolios(reservationId?: string) {
  return useQuery({
    queryKey: ["folios", "res", reservationId], enabled: !!reservationId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_folio_balances").select("*").eq("reservation_id", reservationId).order("created_at");
      if (error) throw error;
      return data as FolioSummary[];
    },
  });
}
export function useFolioList(propertyId: string | undefined, status: string) {
  return useQuery({
    queryKey: ["folios", "list", propertyId, status], enabled: !!propertyId,
    queryFn: async () => {
      let q = (supabase.from as any)("v_folio_balances").select("*").eq("property_id", propertyId);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as FolioSummary[];
    },
  });
}
export function useFolioTransactions(folioId: string) {
  return useQuery({
    queryKey: ["folios", "tx", folioId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_folio_transactions").select("*").eq("folio_id", folioId).order("posted_at");
      if (error) throw error;
      return data as FolioTx[];
    },
  });
}

export function useFolioMutation<T = unknown>(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc<T>(name, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folios"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Opens (creating if needed) the main folio of a booking and goes there. */
export function useOpenMainFolio() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (reservationId: string) => callRpc<string>("open_main_folio", { p_reservation_id: reservationId }),
    onSuccess: (id) => navigate({ to: "/folios/$id", params: { id } }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Stable idempotency key per open dialog, so a retried submit never posts twice. */
function useDialogKey(open: boolean) {
  const [key, setKey] = useState(newKey);
  useEffect(() => { if (open) setKey(newKey()); }, [open]);
  return key;
}

export function PostChargeDialog({ folio, open, onOpenChange }: { folio: FolioSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: codes = [] } = useSetupList<{ id: string; code: string; name: string; category: string; is_taxable: boolean; is_active: boolean }>("charge_codes", "code");
  const m = useFolioMutation("post_charge", "Charge posted.");
  const key = useDialogKey(open);
  const [f, setF] = useState({ code: "", amount: "", inclusive: false, description: "", reference: "" });
  useEffect(() => { if (open) setF({ code: "", amount: "", inclusive: false, description: "", reference: "" }); }, [open]);
  const code = codes.find((c) => c.id === f.code);
  const [preview, setPreview] = useState<{ tax_name: string; amount: number }[]>([]);
  useEffect(() => {
    const n = Number(f.amount);
    if (!code?.is_taxable || !(n > 0)) { setPreview([]); return; }
    const t = setTimeout(() => {
      callRpc<{ tax_name: string; amount: number }[]>("calculate_tax", { p_property_id: folio.property_id, p_amount: n, p_tax_inclusive: f.inclusive })
        .then(setPreview).catch(() => setPreview([]));
    }, 300);
    return () => clearTimeout(t);
  }, [code, f.amount, f.inclusive, folio.property_id]);
  const taxTotal = preview.reduce((s, l) => s + Number(l.amount), 0);
  const n = Number(f.amount) || 0;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Post charge · ${folio.number}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_folio_id: folio.folio_id, p_charge_code_id: f.code, p_amount: n, p_tax_inclusive: f.inclusive,
        p_description: f.description, p_reference: f.reference, p_idempotency_key: key }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Charge" htmlFor="pc-code">
        <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}>
          <SelectTrigger id="pc-code"><SelectValue placeholder="Choose a charge" /></SelectTrigger>
          <SelectContent>{codes.filter((c) => c.is_active && c.category !== "tax").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={`Amount (${folio.currency})`} htmlFor="pc-amt">
        <Input id="pc-amt" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
      </Field>
      {code?.is_taxable && (
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.inclusive} onCheckedChange={(v) => setF({ ...f, inclusive: v })} /> Amount already includes taxes</label>
      )}
      {preview.length > 0 && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {preview.map((l) => <div key={l.tax_name} className="flex justify-between"><span>{l.tax_name}</span><span className="tabular">{formatAmount(l.amount, folio.currency)}</span></div>)}
          <div className="mt-1 flex justify-between border-t pt-1 font-medium"><span>Total</span>
            <span className="tabular">{formatAmount(f.inclusive ? n : n + taxTotal, folio.currency)}</span></div>
        </div>
      )}
      <Field label="Description (optional)" htmlFor="pc-desc"><Input id="pc-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label="Reference (optional)" htmlFor="pc-ref"><Input id="pc-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function RecordPaymentDialog({ folio, open, onOpenChange }: { folio: FolioSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: methods = [] } = useSetupList<{ id: string; name: string; is_active: boolean }>("payment_methods", "code");
  const { data: rates = [] } = useSetupList<{ currency: string }>("exchange_rates", "currency");
  const currencies = [folio.currency, ...new Set(rates.map((r) => r.currency.trim()).filter((c) => c !== folio.currency))];
  const m = useFolioMutation("post_payment", "Payment recorded.");
  const key = useDialogKey(open);
  const due = Math.max(Number(folio.balance), 0);
  const [f, setF] = useState({ method: "", amount: "", currency: folio.currency, deposit: false, reference: "" });
  useEffect(() => { if (open) setF({ method: "", amount: due ? due.toFixed(2) : "", currency: folio.currency, deposit: false, reference: "" }); }, [open, due, folio.currency]);

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Record payment · ${folio.number}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_folio_id: folio.folio_id, p_payment_method_id: f.method, p_amount: Number(f.amount), p_currency: f.currency,
        p_is_deposit: f.deposit, p_description: null, p_reference: f.reference, p_idempotency_key: key }, { onSuccess: () => onOpenChange(false) })}>
      <p className="text-sm text-muted-foreground">Take the payment outside the system first, then record it here.</p>
      <Field label="Method" htmlFor="pp-m">
        <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
          <SelectTrigger id="pp-m"><SelectValue placeholder="How did they pay?" /></SelectTrigger>
          <SelectContent>{methods.filter((x) => x.is_active).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Amount" htmlFor="pp-a"><Input id="pp-a" type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label="Currency" htmlFor="pp-c">
          <Select value={f.currency} onValueChange={(v) => setF({ ...f, currency: v })}>
            <SelectTrigger id="pp-c"><SelectValue /></SelectTrigger>
            <SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      {f.currency !== folio.currency && <p className="text-sm text-muted-foreground">The latest exchange rate on or before the business date is used and saved with the payment.</p>}
      <Field label="Reference (optional)" htmlFor="pp-r" hint="POS slip, transfer reference or receipt number."><Input id="pp-r" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.deposit} onCheckedChange={(v) => setF({ ...f, deposit: v })} /> This is a deposit</label>
    </FormDialog>
  );
}

export function SplitFolioDialog({ folio, rows, open, onOpenChange }: { folio: FolioSummary; rows: FolioTx[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const m = useFolioMutation<string>("split_folio", "New folio created.");
  const key = useDialogKey(open);
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => { if (open) { setLabel(""); setPicked([]); } }, [open]);
  const movable = rows.filter((r) => movableRow(r, rows));
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Split folio ${folio.number}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_folio_id: folio.folio_id, p_label: label, p_guest_id: null, p_transaction_ids: picked, p_idempotency_key: key },
        { onSuccess: (id) => { onOpenChange(false); navigate({ to: "/folios/$id", params: { id } }); } })}>
      <Field label="New folio name" htmlFor="sf-l" hint="For example: Company, Extras, Second guest."><Input id="sf-l" value={label} onChange={(e) => setLabel(e.target.value)} required /></Field>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Move these rows to the new folio (optional)</p>
        {movable.length === 0 && <p className="text-sm text-muted-foreground">No rows can be moved.</p>}
        {movable.map((r) => (
          <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm">
            <Checkbox checked={picked.includes(r.id)} onCheckedChange={(v) => setPicked(v ? [...picked, r.id] : picked.filter((x) => x !== r.id))} />
            <span className="flex-1">{r.description}</span>
            <span className="tabular">{formatAmount(r.total, folio.currency)}</span>
          </label>
        ))}
      </div>
    </FormDialog>
  );
}

/** Charges, payments and rows moved in from another folio can be reversed or moved, once. */
export function movableRow(r: FolioTx, rows: FolioTx[]) {
  if (r.is_reversed || r.is_transferred) return false;
  if (r.kind === "charge" || r.kind === "payment") return true;
  return r.kind === "transfer" && !rows.some((x) => x.id === r.original_id);
}

export function TransferDialog({ folio, rows, initial, open, onOpenChange }: {
  folio: FolioSummary; rows: FolioTx[]; initial: string | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const { data: folios = [] } = useReservationFolios(folio.reservation_id);
  const targets = folios.filter((x) => x.folio_id !== folio.folio_id && x.status === "open");
  const m = useFolioMutation("transfer_transaction", "Moved to the other folio.");
  const key = useDialogKey(open);
  const [row, setRow] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { if (open) { setRow(initial ?? ""); setTo(""); } }, [open, initial]);
  const movable = rows.filter((r) => movableRow(r, rows));
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Transfer to another folio" busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: row, p_to_folio_id: to, p_idempotency_key: key }, { onSuccess: () => onOpenChange(false) })}>
      {targets.length === 0 && <p className="text-sm text-muted-foreground">This stay has no other open folio. Use Split folio to create one.</p>}
      <Field label="Row" htmlFor="tr-row">
        <Select value={row} onValueChange={setRow}>
          <SelectTrigger id="tr-row"><SelectValue placeholder="Choose a row" /></SelectTrigger>
          <SelectContent>{movable.map((r) => <SelectItem key={r.id} value={r.id}>{r.description} · {formatAmount(r.total, folio.currency)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Move to" htmlFor="tr-to">
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger id="tr-to"><SelectValue placeholder="Choose a folio" /></SelectTrigger>
          <SelectContent>{targets.map((x) => <SelectItem key={x.folio_id} value={x.folio_id}>{x.number} · {x.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}

export function ReopenDialog({ folio, open, onOpenChange }: { folio: FolioSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const m = useFolioMutation("reopen_folio", "Folio reopened.");
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Reopen ${folio.number}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: folio.folio_id, p_reason: reason }, { onSuccess: () => onOpenChange(false) })}>
      <Field label="Reason" htmlFor="ro-r"><Input id="ro-r" value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
    </FormDialog>
  );
}

export function useFolioAccess() {
  const { can } = useAccess();
  return {
    charge: can("fin.charge.post"), payment: can("fin.payment.post"), reverse: can("fin.reverse.post"), reopen: can("fin.folio.reopen"),
  };
}
