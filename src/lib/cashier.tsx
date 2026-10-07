import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { callRpc } from "@/lib/setup";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Cashier shifts (FIN-016) and night audit flags (DAY-005). Every figure comes from the database, already in whole
// currency. The browser only shows them and sends what the cashier typed.

export interface ShiftLine {
  payment_method_id: string; method_name: string; method_kind: string;
  expected: number; counted: number | null; variance: number | null;
}
export interface ShiftSummary {
  id: string; status: "open" | "closed"; property_id: string; business_date: string; cashier_id: string; cashier_name: string | null;
  opening_float: number; opened_at: string; closed_at: string | null; close_note: string | null; variance_total: number | null;
  reconciled_at: string | null; reconciled_by_name: string | null; reconcile_note: string | null; lines: ShiftLine[];
}
export interface ShiftRow {
  id: string; cashier_id: string; cashier_name: string; status: "open" | "closed"; business_date: string;
  opened_at: string; closed_at: string | null; opening_float: number; variance_total: number | null; reconciled: boolean;
}
export interface AuditFlag { code: string; title: string; count: number; detail: string | null }
export interface AuditFlags { business_date: string; blocking: AuditFlag[]; warnings: AuditFlag[] }

export const SHIFT_PERMS = ["fin.shift.close", "fin.shift.reconcile"];

export function useShifts(status: string | null) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["cashier", "shifts", property?.id, status], enabled: !!property,
    queryFn: () => callRpc<ShiftRow[]>("list_cashier_shifts", { p_property_id: property!.id, p_from: null, p_to: null, p_status: status }),
  });
}
export function useShift(id: string | null) {
  return useQuery({
    queryKey: ["cashier", "shift", id], enabled: !!id,
    queryFn: () => callRpc<ShiftSummary>("cashier_shift_summary", { p_shift: id }),
  });
}
export function useNightAuditFlags(enabled: boolean) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["cashier", "flags", property?.id], enabled: enabled && !!property,
    queryFn: () => callRpc<AuditFlags>("night_audit_flags", { p_property_id: property!.id }),
  });
}

/** Runs a shift action and refreshes the cashier screens. */
export function useShiftAction<T = unknown>(name: string, success: string, onDone?: (r: T) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc<T>(name, args),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["cashier"] }); toast.success(success); onDone?.(r); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function ShiftStatusBadge({ row }: { row: Pick<ShiftRow, "status" | "variance_total" | "reconciled"> }) {
  if (row.status === "open") return <Badge variant="info" dot>Open</Badge>;
  if (row.reconciled) return <Badge variant="success" dot>Reconciled</Badge>;
  return Number(row.variance_total ?? 0) !== 0
    ? <Badge variant="warning" dot>Needs review</Badge>
    : <Badge variant="neutral" dot>Closed</Badge>;
}

/** What is still open before the day closes. Shown to night audit managers. */
export function NightAuditFlags() {
  const { can } = useAccess();
  const flags = useNightAuditFlags(can("fin.nightaudit.run"));
  const f = flags.data;
  if (!f) return null;
  const all = [...f.blocking.map((x) => ({ ...x, blocking: true })), ...f.warnings.map((x) => ({ ...x, blocking: false }))];
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div>
          <h3 className="text-base font-semibold">Before the day closes</h3>
          <p className="text-sm text-muted-foreground">What is still open for this business date. The date still rolls on its own; clear these first when you can.</p>
        </div>
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is open. You are ready to close the day.</p>
        ) : (
          <ul className="space-y-2">
            {all.map((x) => (
              <li key={x.code} className="flex items-start gap-3 rounded-xl border px-4 py-2.5 text-sm">
                <Badge variant={x.blocking ? "danger" : "warning"}>{x.blocking ? "Clear first" : "Check"}</Badge>
                <div><span className="font-medium">{x.title}: {x.count}</span>{x.detail && <span className="block text-muted-foreground">{x.detail}</span>}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
