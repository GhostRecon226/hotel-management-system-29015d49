import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorCode, errorMessage } from "@/lib/errors";
import { callRpc, Field, FormDialog, useSetupList } from "@/lib/setup";
import type { FolioSummary, FolioTx } from "@/lib/folios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatAmount } from "@/components/ui/money";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ApprovalRow {
  id: string; property_id: string; kind: "discount" | "adjustment" | "reversal" | "refund" | "checkout"; folio_id: string; folio_number: string;
  reservation_id: string; transaction_id: string | null; transaction_description: string | null; amount: number; currency: string;
  reason: string; status: "pending" | "approved" | "rejected" | "withdrawn"; requested_by: string; requested_by_name: string | null;
  requested_at: string; decided_by: string | null; decided_by_name: string | null; decided_at: string | null;
  decision_reason: string | null; posted_transaction_id: string | null; guest_name: string | null;
}
export interface Notification {
  id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string;
}

export const APPROVE_PERM: Record<ApprovalRow["kind"], string> = {
  discount: "fin.discount.approve", adjustment: "fin.adjust.approve", reversal: "fin.reverse.approve", refund: "fin.refund.approve", checkout: "fo.checkout.unsettled",
};
export const KIND_LABEL: Record<ApprovalRow["kind"], string> = { discount: "Discount", adjustment: "Adjustment", reversal: "Reversal", refund: "Refund", checkout: "Check-out with balance" };
export const APPROVAL_MENU_PERMS = [
  ...Object.values(APPROVE_PERM), "fo.checkout", "fin.discount.apply", "fin.adjust.post", "fin.reverse.post", "fin.refund.post",
];

const newKey = () => crypto.randomUUID();
function useDialogKey(open: boolean) {
  const [key, setKey] = useState(newKey);
  useEffect(() => { if (open) setKey(newKey()); }, [open]);
  return key;
}

export function useApprovals(propertyId?: string, folioId?: string) {
  return useQuery({
    queryKey: ["approvals", propertyId, folioId ?? null], enabled: !!propertyId || !!folioId,
    queryFn: async () => {
      let q = (supabase.from as any)("v_approvals").select("*");
      q = folioId ? q.eq("folio_id", folioId) : q.eq("property_id", propertyId);
      const { data, error } = await q.order("requested_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as ApprovalRow[];
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"], refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("notifications").select("*").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data as Notification[];
    },
  });
}

function useMoneyAction(name: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc<{ status: string } | string | null>(name, args),
    onSuccess: () => {
      ["folios", "approvals", "notifications", "reservations"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

function doneToast(r: unknown, posted: string) {
  const status = (r as { status?: string } | null)?.status;
  if (status === "pending") toast.success("Sent for approval. An approver has been notified.");
  else toast.success(posted);
}

export function DiscountDialog({ folio, rows, initial, open, onOpenChange }: {
  folio: FolioSummary; rows: FolioTx[]; initial: string | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const m = useMoneyAction("apply_discount");
  const key = useDialogKey(open);
  const charges = rows.filter((r) => r.kind === "charge" && !r.is_reversed && !r.is_transferred);
  const [f, setF] = useState({ tx: "", amount: "", reason: "" });
  useEffect(() => { if (open) setF({ tx: initial ?? "", amount: "", reason: "" }); }, [open, initial]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Give a discount" busy={m.isPending}
      onSubmit={() => m.mutate({ p_transaction_id: f.tx, p_amount: Number(f.amount), p_reason: f.reason, p_idempotency_key: key },
        { onSuccess: (r) => { doneToast(r, "Discount posted."); onOpenChange(false); }, onError: (e) => toast.error(errorMessage(e)) })}>
      <p className="text-sm text-muted-foreground">Discounts within your limit are posted at once. Larger ones wait for approval. Tax is reduced in proportion.</p>
      <Field label="Charge" htmlFor="d-tx">
        <Select value={f.tx} onValueChange={(v) => setF({ ...f, tx: v })}>
          <SelectTrigger id="d-tx"><SelectValue placeholder="Choose a charge" /></SelectTrigger>
          <SelectContent>{charges.map((r) => <SelectItem key={r.id} value={r.id}>{r.description} · {formatAmount(r.total, folio.currency)}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={`Discount amount incl. tax (${folio.currency})`} htmlFor="d-amt"><Input id="d-amt" type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
      <Field label="Reason" htmlFor="d-r"><Input id="d-r" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
    </FormDialog>
  );
}

export function AdjustmentDialog({ folio, open, onOpenChange }: { folio: FolioSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: codes = [] } = useSetupList<{ id: string; name: string; is_active: boolean }>("charge_codes", "code");
  const m = useMoneyAction("request_adjustment");
  const key = useDialogKey(open);
  const [f, setF] = useState({ dir: "up", code: "", amount: "", reason: "" });
  useEffect(() => { if (open) setF({ dir: "up", code: "", amount: "", reason: "" }); }, [open]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Request an adjustment" busy={m.isPending}
      onSubmit={() => m.mutate({ p_folio_id: folio.folio_id, p_charge_code_id: f.code || null,
        p_amount: (f.dir === "up" ? 1 : -1) * Number(f.amount), p_reason: f.reason, p_idempotency_key: key },
        { onSuccess: (r) => { doneToast(r, "Adjustment posted."); onOpenChange(false); }, onError: (e) => toast.error(errorMessage(e)) })}>
      <p className="text-sm text-muted-foreground">Adjustments always need approval. No tax is added.</p>
      <Field label="Direction" htmlFor="a-dir">
        <Select value={f.dir} onValueChange={(v) => setF({ ...f, dir: v })}>
          <SelectTrigger id="a-dir"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="up">Add to the bill</SelectItem><SelectItem value="down">Take off the bill</SelectItem></SelectContent>
        </Select>
      </Field>
      <Field label="Charge code (optional)" htmlFor="a-code">
        <Select value={f.code} onValueChange={(v) => setF({ ...f, code: v })}>
          <SelectTrigger id="a-code"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>{codes.filter((c) => c.is_active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={`Amount (${folio.currency})`} htmlFor="a-amt"><Input id="a-amt" type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
      <Field label="Reason" htmlFor="a-r"><Input id="a-r" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
    </FormDialog>
  );
}

export function RefundDialog({ folio, open, onOpenChange }: { folio: FolioSummary; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: methods = [] } = useSetupList<{ id: string; name: string; is_active: boolean }>("payment_methods", "code");
  const m = useMoneyAction("request_refund");
  const key = useDialogKey(open);
  const credit = Math.max(-Number(folio.balance), 0);
  const [f, setF] = useState({ method: "", amount: "", reference: "", reason: "" });
  useEffect(() => { if (open) setF({ method: "", amount: credit ? credit.toFixed(2) : "", reference: "", reason: "" }); }, [open, credit]);
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Request a refund" busy={m.isPending}
      onSubmit={() => m.mutate({ p_folio_id: folio.folio_id, p_payment_method_id: f.method, p_amount: Number(f.amount), p_currency: folio.currency,
        p_reference: f.reference, p_reason: f.reason, p_idempotency_key: key },
        { onSuccess: (r) => { doneToast(r, "Refund posted."); onOpenChange(false); }, onError: (e) => toast.error(errorMessage(e)) })}>
      <p className="text-sm text-muted-foreground">Refunds always need approval. Only return the money after it is approved. Credit on this folio: {formatAmount(credit, folio.currency)}.</p>
      <Field label="Returned by" htmlFor="rf-m">
        <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
          <SelectTrigger id="rf-m"><SelectValue placeholder="Choose a method" /></SelectTrigger>
          <SelectContent>{methods.filter((x) => x.is_active).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={`Amount (${folio.currency})`} htmlFor="rf-a"><Input id="rf-a" type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
      <Field label="Reference (optional)" htmlFor="rf-ref"><Input id="rf-ref" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
      <Field label="Reason" htmlFor="rf-r"><Input id="rf-r" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
    </FormDialog>
  );
}

export function RequestReversalDialog({ row, currency, onOpenChange }: { row: FolioTx | null; currency: string; onOpenChange: (o: boolean) => void }) {
  const m = useMoneyAction("request_reversal");
  const key = useDialogKey(!!row);
  const [reason, setReason] = useState("");
  useEffect(() => { if (row) setReason(""); }, [row]);
  return (
    <FormDialog open={!!row} onOpenChange={onOpenChange} title="Request a reversal" busy={m.isPending}
      onSubmit={() => m.mutate({ p_transaction_id: row!.id, p_reason: reason, p_idempotency_key: key },
        { onSuccess: (r) => { doneToast(r, "Reversal posted."); onOpenChange(false); }, onError: (e) => toast.error(errorMessage(e)) })}>
      <p className="text-[15px]">Once approved, an opposite row of <strong>{formatAmount(-Number(row?.total ?? 0), currency)}</strong> is posted. The original stays on the folio.</p>
      <Field label="Reason" htmlFor="rq-r"><Input id="rq-r" value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
    </FormDialog>
  );
}

export function DecideDialog({ approval, approve, onOpenChange }: { approval: ApprovalRow | null; approve: boolean; onOpenChange: (o: boolean) => void }) {
  const m = useMoneyAction("decide_approval");
  const [reason, setReason] = useState("");
  const [sod, setSod] = useState<string | null>(null);
  useEffect(() => { if (approval) { setReason(""); setSod(null); } }, [approval]);
  return (
    <FormDialog open={!!approval} onOpenChange={onOpenChange} title={`${approve ? "Approve" : "Reject"} ${approval ? KIND_LABEL[approval.kind].toLowerCase() : ""}`} busy={m.isPending}
      onSubmit={() => m.mutate({ p_id: approval!.id, p_approve: approve, p_reason: reason }, {
        onSuccess: () => {
          toast.success(!approve ? "Rejected. Nothing was posted."
            : approval!.kind === "checkout" ? "Approved. The front desk can now check the guest out."
            : "Approved and posted.");
          onOpenChange(false);
        },
        onError: (e) => {
          if (errorCode(e) === "E_SOD") setSod(errorMessage(e));
          else toast.error(errorMessage(e));
        },
      })}>
      {sod && (
        <Alert variant="destructive">
          <AlertTitle>You cannot decide your own request [E_SOD]</AlertTitle>
          <AlertDescription>{sod}</AlertDescription>
        </Alert>
      )}
      {approval && (
        <p className="text-[15px]">
          {approval.requested_by_name ?? "Someone"} asked for a {KIND_LABEL[approval.kind].toLowerCase()} of{" "}
          <strong>{formatAmount(Math.abs(approval.amount), approval.currency)}</strong> on folio {approval.folio_number}: “{approval.reason}”
        </p>
      )}
      <Field label="Reason" htmlFor="dc-r"><Input id="dc-r" value={reason} onChange={(e) => setReason(e.target.value)} required /></Field>
    </FormDialog>
  );
}

export function useWithdraw() {
  const m = useMoneyAction("withdraw_approval");
  return (id: string) => m.mutate({ p_id: id }, { onSuccess: () => toast.success("Request withdrawn."), onError: (e) => toast.error(errorMessage(e)) });
}

export function useCanDecide() {
  const { can, ctx } = useAccess();
  return (a: ApprovalRow) => a.status === "pending" && can(APPROVE_PERM[a.kind]) && a.requested_by !== ctx.user_id;
}
