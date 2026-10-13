// Platform console (wave 2, item 2; PLT-008, PLT-009, PLT-013). For platform operators only: separate sign-ins that
// belong to no hotel. The database refuses every platform call unless the account is on the operator list and the
// session passed two-step sign-in (aal2); the screen only follows those rules.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/setup";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PlatformTenant {
  tenant_id: string; hotel_name: string; country: string; access_status: string; subscription_status: string;
  plan_code: string; plan_name: string; trial_ends_at: string | null; paid_until: string | null; created_at: string;
  properties: number; rooms: number; active_users: number; last_change_at: string | null;
}
export interface PlatformHistoryRow {
  created_at: string; from_status: string | null; to_status: string; plan_code: string | null; period_end: string | null;
  reason: string; source: string; operator_email: string | null;
}
export type PlatformAction = "extend_trial" | "activate" | "suspend" | "change_plan" | "cancel";

export { whoamiQuery } from "@/lib/queries";

export function usePlatformTenants(enabled: boolean) {
  return useQuery({ queryKey: ["platform", "tenants"], enabled, queryFn: () => callRpc<PlatformTenant[]>("platform_list_tenants", {}) });
}
export function usePlatformHistory(tenantId: string | null) {
  return useQuery({
    queryKey: ["platform", "history", tenantId], enabled: !!tenantId,
    queryFn: () => callRpc<PlatformHistoryRow[]>("platform_tenant_history", { p_tenant: tenantId }),
  });
}
export interface FailedPayment {
  payment_id: string; created_at: string; tenant_id: string; tenant_name: string; plan_code: string; period: "month" | "year";
  amount: number; currency: string; status: "pending" | "failed"; reference: string; failure_reason: string | null;
}
/** Failed payments and payments left waiting more than a day. Amounts arrive in whole currency from the database. */
export function usePlatformFailedPayments(enabled: boolean) {
  return useQuery({ queryKey: ["platform", "failed-payments"], enabled, queryFn: () => callRpc<FailedPayment[]>("platform_failed_payments", {}) });
}
export interface PlatformSummary {
  generated_at: string; hotels: number; by_status: Record<string, number>; joined_7d: number; joined_30d: number; joined_prev_7d: number; joined_change_pct: number | null; joined_weekly: number[];
  trials_ending: Array<{ tenant_id: string; hotel_name: string; country: string; trial_ends_at: string; days: number }>;
  quiet: Array<{ tenant_id: string; hotel_name: string; country: string; last_sign_in_at: string | null; days_inactive: number | null }>;
  monthly_value: Array<{ currency: string; amount: number; hotels: number }>;
}
export function usePlatformSummary(enabled: boolean) {
  return useQuery({ queryKey: ["platform", "summary"], enabled, queryFn: () => callRpc<PlatformSummary>("platform_summary", {}) });
}
export function usePlans() {
  return useQuery({
    queryKey: ["platform", "plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("code, name, max_rooms, max_properties, max_users").order("max_rooms", { nullsFirst: false });
      if (error) throw error;
      return data as Array<{ code: string; name: string; max_rooms: number | null; max_properties: number | null; max_users: number | null }>;
    },
  });
}
export function usePlatformChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { tenant: string; action: PlatformAction; reason: string; until: string | null; plan: string | null }) =>
      callRpc("platform_change_subscription", { p_tenant: v.tenant, p_action: v.action, p_reason: v.reason, p_until: v.until, p_plan: v.plan }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform"] }); toast.success("Saved. The hotel's banner shows the new status."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Whole days from today to a date (negative when past). Dates only, no money. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
/** End of the chosen day, in the operator's time zone, as the database's timestamp. */
export function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString();
}

/**
 * Two-step sign-in with an authenticator app (Supabase MFA, TOTP). First visit: scan the code and confirm.
 * Later visits: type the 6-digit code. Afterwards the session is aal2 and the platform functions answer.
 */
export function TwoStepGate({ onDone }: { onDone: () => void }) {
  const factors = useQuery({ queryKey: ["platform", "factors"], queryFn: async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data;
  } });
  const [enrol, setEnrol] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const verified = factors.data?.totp?.[0];

  async function startEnrol() {
    setBusy(true);
    try {
      // Remove a half-finished set-up from an earlier visit, then start again.
      for (const f of factors.data?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Zikora platform ${new Date().toISOString().slice(0, 10)}` });
      if (error) throw error;
      setEnrol({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    const factorId = enrol?.id ?? verified?.id;
    if (!factorId) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
      if (error) throw error;
      setCode("");
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  }

  if (factors.isLoading) return <p className="text-sm text-muted-foreground">Checking your sign-in…</p>;
  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-xl font-semibold">Confirm it is you</h2>
      {!verified && !enrol && (
        <>
          <p className="text-[15px] text-muted-foreground">The platform console needs two-step sign-in. Set up an authenticator app (for example Google Authenticator or 1Password) once; after that you type a 6-digit code each time you sign in.</p>
          <Button onClick={startEnrol} disabled={busy}>Set up the authenticator app</Button>
        </>
      )}
      {enrol && (
        <div className="space-y-3">
          <p className="text-[15px]">Scan this code with your authenticator app, then type the 6-digit code it shows.</p>
          <img src={enrol.qr} alt="Code to scan with the authenticator app" className="size-48 rounded-md border bg-white p-2" />
          <p className="text-sm text-muted-foreground">Cannot scan? Type this key into the app instead: <span className="font-mono">{enrol.secret}</span></p>
        </div>
      )}
      {(verified || enrol) && (
        <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code">6-digit code</Label>
            <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="w-40" required />
          </div>
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Confirm"}</Button>
        </form>
      )}
    </div>
  );
}

// Support access (PLT-010): ask a hotel for permission, then read its account snapshot while the hotel allows it.
export interface SupportRequest {
  id: string; status: string; reason: string; hours_requested: number; requested_at: string;
  decided_at: string | null; expires_at: string | null; views: number;
}
export interface SupportSnapshot {
  hotel: { name: string; country: string; access_status: string; subscription_status: string; plan_code: string; trial_ends_at: string | null; paid_until: string | null };
  properties: Array<{ name: string; timezone: string; business_date: string; rooms: number; active_staff: number }>;
  business_date_runs: Array<{ property: string; from_date: string; to_date: string; status: string; trigger: string; finished_at: string; error: string | null }>;
  messages: { pending: number; failed: number; sent_last_24h: number };
  access: { expires_at: string; views: number };
}
export function useSupportRequests(tenantId: string | null) {
  return useQuery({
    queryKey: ["platform", "support", tenantId], enabled: !!tenantId,
    queryFn: () => callRpc<SupportRequest[]>("platform_support_requests", { p_tenant: tenantId }),
  });
}
export function useSupportRequest(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { reason: string; hours: number }) =>
      callRpc("platform_request_support_access", { p_tenant: tenantId, p_reason: v.reason, p_hours: v.hours }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform", "support"] }); toast.success("Request sent. The hotel's administrators were told."); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
/** Opening the snapshot counts as one view in the hotel's audit log, so it runs only when the operator asks. */
export function useSupportSnapshot(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callRpc<SupportSnapshot>("platform_support_snapshot", { p_tenant: tenantId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform", "support"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
