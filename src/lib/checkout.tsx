import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";
import { callRpcQueued, QUEUED } from "@/lib/offline/queue";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CheckoutStay {
  stay_id: string; reservation_id: string; property_id: string; number: string; status: "in_house" | "checked_out";
  room_number: string; guest_name: string | null; arrival_date: string; departure_date: string; reservation_status: string;
  checked_out_at: string | null; checkout_business_date: string | null; checkout_reason: string | null; currency: string; can_undo: boolean;
}
export interface CheckoutApproval {
  id: string; status: "pending" | "approved" | "rejected" | "withdrawn"; amount: number; currency: string; reason: string;
  requested_by_name: string | null; decided_by_name: string | null; decision_reason: string | null; is_used: boolean; requested_at: string;
}
export interface TaxSplitLine { line_no: number; tax_code: string; tax_name: string; percent: number; taxable_base: number; amount: number }
export interface InvoiceLine {
  id: string; date: string; kind: string; description: string; net: number; tax: number; total: number;
  tax_lines: { name: string; percent: number; amount: number }[]; is_reversed: boolean; is_transferred: boolean;
  reference?: string | null;
}
export interface InvoiceDayTotal { date: string; net: number; tax: number; total: number }
export interface Invoice {
  id: string; folio_id: string; number: string; kind: "interim" | "final"; currency: string; issued_at: string; business_date: string;
  net_total: number; tax_total: number; gross_total: number; payments_total: number; balance: number;
  tax_split: TaxSplitLine[]; lines: InvoiceLine[];
  header: { hotel?: string; property?: string; address?: string | null; city?: string | null; country?: string | null; folio_number?: string;
    folio_label?: string; reservation_number?: string; guest_name?: string | null; company_name?: string | null;
    arrival_date?: string; departure_date?: string; room_number?: string | null;
    // Added in FIN-019; invoices issued earlier do not have them.
    adults?: number; children?: number; nights?: number; checked_in_at?: string | null; day_totals?: InvoiceDayTotal[] };
}

export function useCheckoutStay(reservationId: string) {
  return useQuery({
    queryKey: ["checkout", "stay", reservationId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_checkouts").select("*").eq("reservation_id", reservationId)
        .order("checked_out_at", { ascending: false, nullsFirst: true }).limit(1).maybeSingle();
      if (error) throw error;
      return data as CheckoutStay | null;
    },
  });
}

export function useCheckoutApprovals(reservationId: string) {
  return useQuery({
    queryKey: ["approvals", "checkout", reservationId],
    queryFn: async () => {
      const { data: folios, error: e1 } = await (supabase.from as any)("folios").select("id").eq("reservation_id", reservationId);
      if (e1) throw e1;
      const ids = (folios ?? []).map((f: { id: string }) => f.id);
      if (!ids.length) return [] as CheckoutApproval[];
      const { data, error } = await (supabase.from as any)("v_approvals").select("*").eq("kind", "checkout").in("folio_id", ids)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data as CheckoutApproval[];
    },
  });
}

export function useCheckoutAction<T = unknown>(name: string, success: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpcQueued<T>(name, args) as Promise<T>,
    onSuccess: (d) => {
      if ((d as unknown) === QUEUED) { toast.info("Saved on this device. It will be sent when the connection returns."); return; }
      ["checkout", "folios", "reservations", "approvals", "front-desk", "rooms", "notifications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(success);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useFolioInvoices(folioId: string) {
  return useQuery({
    queryKey: ["folios", "invoices", folioId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("invoices").select("id, number, kind, issued_at, gross_total, currency")
        .eq("folio_id", folioId).order("issued_at", { ascending: false });
      if (error) throw error;
      return data as Pick<Invoice, "id" | "number" | "kind" | "issued_at" | "gross_total" | "currency">[];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("invoices").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Invoice | null;
    },
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (args: { folioId: string; kind: "interim" | "final" }) =>
      callRpc<string>("issue_invoice", { p_folio_id: args.folioId, p_kind: args.kind, p_idempotency_key: crypto.randomUUID() }),
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ["folios"] }); navigate({ to: "/invoices/$id", params: { id } }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function usePostRoomCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: string) => callRpc<{ posted: number; skipped: number; business_date: string }>("post_room_charges", { p_property_id: propertyId }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["folios"] });
      toast.success(`Room charges posted: ${r.posted}. Already charged or skipped: ${r.skipped}.`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
